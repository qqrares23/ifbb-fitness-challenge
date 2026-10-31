import { assignPlaces } from "./places";
import type { RankedRow, RepScore } from "./types";

/**
 * Fitness Challenge: ranks one category by total reps across all stations, highest first.
 * Equal totals are split by reps on the last station, then the one before it, and so on;
 * rows equal on every station share a place and the following place is skipped (1, 1, 3).
 * A missing station counts as 0, but rows with no result at all come after every row with one.
 *
 * Rows that stay tied keep the order of `entries`, so pass entries in the order you
 * want ties listed (e.g. by bib number). Scores for unknown entries or stations are ignored.
 */
export function rankCategory<T extends { id: number }>(
  entries: readonly T[],
  stationNumbers: readonly number[],
  scores: readonly RepScore[],
): RankedRow<T>[] {
  const repsByEntry = new Map<number, Map<number, number>>();
  for (const score of scores) {
    let byStation = repsByEntry.get(score.entryId);
    if (!byStation) repsByEntry.set(score.entryId, (byStation = new Map()));
    byStation.set(score.stationNumber, score.reps);
  }

  const rows = entries.map((entry) => {
    const recorded = repsByEntry.get(entry.id);
    const perStation = new Map<number, number | null>();
    let totalReps = 0;
    let complete = true;
    for (const station of stationNumbers) {
      const reps = recorded?.get(station) ?? null;
      perStation.set(station, reps);
      if (reps === null) complete = false;
      else totalReps += reps;
    }
    return { entry, totalReps, perStation, complete, place: 0 };
  });

  // Tie-break: more reps on the last station wins, then the one before it, and so on.
  const lastFirst = [...stationNumbers].sort((a, b) => b - a);
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    if (a.totalReps !== b.totalReps) return b.totalReps - a.totalReps;
    // Equal totals of 0: an athlete who recorded 0 is placed, one with no results isn't.
    const noResults = (row: (typeof rows)[number]) => Number(!repsByEntry.has(row.entry.id) || stationNumbers.every((s) => row.perStation.get(s) === null));
    if (noResults(a) !== noResults(b)) return noResults(a) - noResults(b);
    for (const station of lastFirst) {
      const diff = (b.perStation.get(station) ?? 0) - (a.perStation.get(station) ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  // Array.prototype.sort is stable, which is what keeps ties in input order.
  rows.sort(compare);
  assignPlaces(rows, compare).forEach((place, index) => (rows[index]!.place = place));
  return rows;
}
