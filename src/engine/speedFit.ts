import { assignPlaces } from "./places";
import type { EntryTime, TimedRow } from "./types";

/**
 * Speed Fit: ranks one category by the time taken to complete the whole set, fastest first.
 * Equal times share a place (1, 1, 3). Athletes without a time come last, unplaced.
 * Ties and the unplaced keep the order of `entries` (e.g. bib order).
 */
export function rankByTime<T extends { id: number }>(entries: readonly T[], times: readonly EntryTime[]): TimedRow<T>[] {
  const timeByEntry = new Map(times.map((t) => [t.entryId, t.timeMs]));
  const rows = entries.map((entry) => ({ entry, timeMs: timeByEntry.get(entry.id) ?? null, place: null as number | null }));

  const byTime = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.timeMs! - b.timeMs!;
  const timed = rows.filter((row) => row.timeMs !== null).sort(byTime);
  assignPlaces(timed, byTime).forEach((place, index) => (timed[index]!.place = place));
  return [...timed, ...rows.filter((row) => row.timeMs === null)];
}
