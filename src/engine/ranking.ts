import type { RankedRow, RepScore } from "./types";

/**
 * Ranks one category: total reps across all stations, highest first.
 * Equal totals share a place and the following place is skipped (1, 1, 3).
 *
 * Rows with equal totals keep the order of `entries`, so pass entries in the order you
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

  // Array.prototype.sort is stable, which is what keeps ties in input order.
  rows.sort((a, b) => b.totalReps - a.totalReps);
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.place = previous && previous.totalReps === row.totalReps ? previous.place : index + 1;
  });

  return rows;
}
