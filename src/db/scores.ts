import type { RepScore } from "@/engine";
import { db } from "./client";

/** Matches the CHECK on scores.reps in the migrations. */
export const MAX_REPS = 9999;

/** Reps at one station of one station set. */
export interface SetRepScore extends RepScore {
  setId: number;
}

export async function listScores(competitionId: number): Promise<SetRepScore[]> {
  return (await db()).select<SetRepScore[]>(
    `SELECT s.entry_id AS entryId, s.set_id AS setId, s.station_number AS stationNumber, s.reps
     FROM scores s JOIN entries e ON e.id = s.entry_id
     WHERE e.competition_id = $1`,
    [competitionId],
  );
}

/** Records an athlete's reps at a station of their category's set; null clears the result. */
export async function setScore({ entryId, setId, stationNumber, reps }: { entryId: number; setId: number; stationNumber: number; reps: number | null }) {
  const conn = await db();
  if (reps === null) {
    await conn.execute("DELETE FROM scores WHERE entry_id = $1 AND set_id = $2 AND station_number = $3", [entryId, setId, stationNumber]);
    return;
  }
  if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) throw new Error(`Reps must be a whole number from 0 to ${MAX_REPS}.`);
  await conn.execute(
    `INSERT INTO scores (entry_id, set_id, station_number, reps) VALUES ($1, $2, $3, $4)
     ON CONFLICT (entry_id, set_id, station_number) DO UPDATE SET reps = excluded.reps, updated_at = datetime('now')`,
    [entryId, setId, stationNumber, reps],
  );
}
