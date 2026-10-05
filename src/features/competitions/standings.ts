import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import type { RecordedResults } from "@/db/results";
import { formatDuration, rankByTime, rankCategory, type RankedRow, type TimedRow } from "@/engine";

interface CategoryResultsBase {
  category: Category;
  /** Fitness Challenge: station results still empty. Speed Fit: athletes without a time. */
  missingResults: number;
}

export interface FitnessChallengeStandings extends CategoryResultsBase {
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
  const stationNumbers = setup.stations.map((s) => s.stationNumber);
  return {
    kind: "fitness_challenge",
    categories: setup.categories.map((category) => {
      const rows = rankCategory(categoryEntries(setup, category), stationNumbers, recorded.scores);
      const missingResults = rows.reduce((sum, row) => sum + [...row.perStation.values()].filter((reps) => reps === null).length, 0);
      return { category, rows, missingResults };
    }),
  };
}

/** A challenge-neutral view of a ranked row, for leaderboards. */
export interface LeaderboardRow {
  entry: Entry;
  place: number | null;
  /** The ranking value as displayed: total reps, or the time. */
  value: string;
  /** Whether the athlete has any result yet (only ranked athletes can be shown as a winner). */
  ranked: boolean;
  /** Shown under the name, e.g. that results are incomplete. */
  note?: string;
}

export function leaderboardRows(results: CompetitionResults, categoryIndex: number): LeaderboardRow[] {
  if (results.kind === "speed_fit") {
    return (results.categories[categoryIndex]?.rows ?? []).map((r) => ({
      entry: r.entry,
      place: r.place,
      ranked: r.timeMs !== null,
      value: r.timeMs === null ? "—" : formatDuration(r.timeMs),
      note: r.timeMs === null ? "No time yet" : undefined,
    }));
  }
  return (results.categories[categoryIndex]?.rows ?? []).map((r) => ({
    entry: r.entry,
    place: r.place,
    ranked: [...r.perStation.values()].some((reps) => reps !== null),
    value: String(r.totalReps),
    note: r.complete ? undefined : "Results incomplete",
  }));
}
