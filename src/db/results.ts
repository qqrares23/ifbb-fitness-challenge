import type { EntryTime } from "@/engine";
import { db } from "./client";
import { listScores, type SetRepScore } from "./scores";
import { listTimes } from "./speedFitTimes";

/** The recorded results of a competition: reps of its Fitness Challenge categories, times of its Speed Fit ones. */
export interface RecordedResults {
  scores: SetRepScore[];
  times: EntryTime[];
}

export async function listResults(competitionId: number): Promise<RecordedResults> {
  const [scores, times] = await Promise.all([listScores(competitionId), listTimes(competitionId)]);
  return { scores, times };
}

/** Deletes every rep and time of a running competition (e.g. after a trial run); the setup stays. */
export async function clearResults(competitionId: number): Promise<void> {
  const conn = await db();
  for (const table of ["scores", "speed_fit_times"]) {
    await conn.execute(`DELETE FROM ${table} WHERE entry_id IN (SELECT id FROM entries WHERE competition_id = $1)`, [competitionId]);
  }
}
