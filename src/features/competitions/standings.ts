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

/** One station set's ranking within a category. */
export interface SetStandings {
  stationSet: StationSet;
  rows: RankedRow<Entry>[];
  /** Station results of this set still empty. */
  missingResults: number;
}

export interface FitnessChallengeStandings extends CategoryResultsBase {
  /** One ranking per station set the category uses, in set order (empty until a set is picked). */
  sets: SetStandings[];
  /**
   * With several sets: the overall ranking by the sum of the set totals. Its `perStation` maps each
   * set's index in `sets` to the athlete's total there (null where they have no reps in that set).
   * null with a single set.
   */
  overall: RankedRow<Entry>[] | null;
  /** The ranking that stands for the category: the overall one with several sets, else its one set's. */
  rows: RankedRow<Entry>[];
}

export interface SpeedFitStandings extends CategoryResultsBase {
  rows: TimedRow<Entry>[];
}

export type CompetitionResults =
  | { kind: "fitness_challenge"; categories: FitnessChallengeStandings[] }
  | { kind: "speed_fit"; categories: SpeedFitStandings[] };

const missingStationResults = (rows: RankedRow<Entry>[]) =>
  rows.reduce((sum, row) => sum + [...row.perStation.values()].filter((reps) => reps === null).length, 0);

/** Whether an athlete has any result in a ranking (athletes without any are unplaced). */
export const hasReps = (row: RankedRow<Entry>) => [...row.perStation.values()].some((reps) => reps !== null);

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
      const entries = categoryEntries(setup, category);
      // Each set the category uses is ranked on its own stations and reps. Reps on a set the
      // category no longer uses are kept but not ranked.
      const sets = category.stationSetIds.flatMap((setId) => {
        const stationSet = setup.stationSets.find((s) => s.id === setId);
        if (!stationSet) return [];
        const scores = recorded.scores.filter((s) => s.setId === setId);
        const rows = rankCategory(entries, stationSet.stations.map((s) => s.stationNumber), scores);
        return [{ stationSet, rows, missingResults: missingStationResults(rows) }];
      });
      // Overall: the same ranking rule, with each set's total standing in for a station.
      const overall =
        sets.length > 1
          ? rankCategory(
              entries,
              sets.map((_, i) => i),
              sets.flatMap((set, i) => set.rows.filter(hasReps).map((row) => ({ entryId: row.entry.id, stationNumber: i, reps: row.totalReps }))),
            )
          : null;
      return {
        category,
        sets,
        overall,
        rows: overall ?? sets[0]?.rows ?? rankCategory(entries, [], []),
        missingResults: sets.reduce((sum, set) => sum + set.missingResults, 0),
      };
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
