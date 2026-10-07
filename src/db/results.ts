import type { EntryTime } from "@/engine";
import { db } from "./client";
import type { Competition } from "./competitions";
import { listScores, type SetRepScore } from "./scores";
import { listTimes } from "./speedFitTimes";

/** The recorded results of a competition, in the shape its challenge type uses. */
export type RecordedResults = { kind: "fitness_challenge"; scores: SetRepScore[] } | { kind: "speed_fit"; times: EntryTime[] };

export async function listResults({ id, kind }: Pick<Competition, "id" | "kind">): Promise<RecordedResults> {
  return kind === "speed_fit" ? { kind, times: await listTimes(id) } : { kind, scores: await listScores(id) };
}

/** Deletes every rep or time of a running competition (e.g. after a trial run); the setup stays. */
export async function clearResults({ id, kind }: Pick<Competition, "id" | "kind">): Promise<void> {
  const table = kind === "speed_fit" ? "speed_fit_times" : "scores";
  await (await db()).execute(`DELETE FROM ${table} WHERE entry_id IN (SELECT id FROM entries WHERE competition_id = $1)`, [id]);
}
