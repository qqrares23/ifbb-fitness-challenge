import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import type { RecordedResults } from "@/db/results";
import type { StationSet } from "@/db/stations";
import { rankByTime, rankCategory, type RankedRow, type TimedRow } from "@/engine";

interface CategoryResultsBase {
  category: Category;
  /** Fitness Challenge: station results still empty. Speed Fit: athletes without a time. */
  missingResults: number;
}

export interface FitnessChallengeStandings extends CategoryResultsBase {
  /** The station set the category is scored on; null until one is picked. */
  stationSet: StationSet | null;
  rows: RankedRow<Entry>[];
}

export interface SpeedFitStandings extends CategoryResultsBase {
  rows: TimedRow<Entry>[];
}

export type CompetitionResults =
  | { kind: "fitness_challenge"; categories: FitnessChallengeStandings[] }
  | { kind: "speed_fit"; categories: SpeedFitStandings[] };

/** Entries of one category in bib order — the order ties and unplaced athletes are listed in. */
function categoryEntries(setup: CompetitionSetup, category: Category): Entry[] {
  return setup.entries.filter((e) => e.categoryId === category.id).sort((a, b) => a.bibNumber - b.bibNumber);
}

/**
 * The one place a competition gets ranked: the live screens, the results view and every export
 * read from this, so they can never disagree.
 */
export function competitionResults(setup: CompetitionSetup, recorded: RecordedResults): CompetitionResults {
  if (recorded.kind === "speed_fit") {
    return {
      kind: "speed_fit",
      categories: setup.categories.map((category) => {
        const rows = rankByTime(categoryEntries(setup, category), recorded.times);
        return { category, rows, missingResults: rows.filter((r) => r.timeMs === null).length };
      }),
    };
  }
  return {
    kind: "fitness_challenge",
    categories: setup.categories.map((category) => {
      // Only the category's current set counts; reps on other sets are kept but not ranked.
      const stationSet = setup.stationSets.find((s) => s.id === category.stationSetId) ?? null;
      const stationNumbers = stationSet?.stations.map((s) => s.stationNumber) ?? [];
      const scores = recorded.scores.filter((s) => s.setId === stationSet?.id);
      const rows = rankCategory(categoryEntries(setup, category), stationNumbers, scores);
      const missingResults = rows.reduce((sum, row) => sum + [...row.perStation.values()].filter((reps) => reps === null).length, 0);
      return { category, stationSet, rows, missingResults };
    }),
  };
}

/**
 * Entries with any recorded result, on any station set: they can't be moved to another category
 * (the database refuses, see 0005), and removing them deletes results.
 */
export function entriesWithResults(recorded: RecordedResults | undefined): ReadonlySet<number> {
  if (!recorded) return new Set();
  return new Set(recorded.kind === "speed_fit" ? recorded.times.map((t) => t.entryId) : recorded.scores.map((s) => s.entryId));
}
