import type { RepScore } from "@/engine";
import { db } from "./client";

/** Matches the CHECK on scores.reps in 0001_init.sql. */
export const MAX_REPS = 9999;

export async function listScores(competitionId: number): Promise<RepScore[]> {
  return (await db()).select<RepScore[]>(
    `SELECT s.entry_id AS entryId, s.station_number AS stationNumber, s.reps
     FROM scores s JOIN entries e ON e.id = s.entry_id
     WHERE e.competition_id = $1`,
    [competitionId],
  );
}

/** Records an athlete's reps at a station; null clears the result. */
export async function setScore({ entryId, stationNumber, reps }: { entryId: number; stationNumber: number; reps: number | null }) {
  const conn = await db();
  if (reps === null) {
    await conn.execute("DELETE FROM scores WHERE entry_id = $1 AND station_number = $2", [entryId, stationNumber]);
    return;
  }
  if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) throw new Error(`Reps must be a whole number from 0 to ${MAX_REPS}.`);
  await conn.execute(
    `INSERT INTO scores (entry_id, station_number, reps) VALUES ($1, $2, $3)
     ON CONFLICT (entry_id, station_number) DO UPDATE SET reps = excluded.reps, updated_at = datetime('now')`,
    [entryId, stationNumber, reps],
  );
}
