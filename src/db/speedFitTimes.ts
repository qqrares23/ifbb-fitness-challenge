import { MAX_TIME_MS, type EntryTime } from "@/engine";
import { db } from "./client";

export async function listTimes(competitionId: number): Promise<EntryTime[]> {
  return (await db()).select<EntryTime[]>(
    `SELECT t.entry_id AS entryId, t.time_ms AS timeMs
     FROM speed_fit_times t JOIN entries e ON e.id = t.entry_id
     WHERE e.competition_id = $1`,
    [competitionId],
  );
}

/** Records an athlete's Speed Fit time; null clears it. */
export async function setTime({ entryId, timeMs }: { entryId: number; timeMs: number | null }): Promise<void> {
  const conn = await db();
  if (timeMs === null) {
    await conn.execute("DELETE FROM speed_fit_times WHERE entry_id = $1", [entryId]);
    return;
  }
  if (!Number.isInteger(timeMs) || timeMs <= 0 || timeMs > MAX_TIME_MS) throw new Error("That is not a valid time.");
  await conn.execute(
    `INSERT INTO speed_fit_times (entry_id, time_ms) VALUES ($1, $2)
     ON CONFLICT (entry_id) DO UPDATE SET time_ms = excluded.time_ms, updated_at = datetime('now')`,
    [entryId, timeMs],
  );
}
