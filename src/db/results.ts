import type { EntryTime } from "@/engine";
import type { Competition } from "./competitions";
import { listScores, type SetRepScore } from "./scores";
import { listTimes } from "./speedFitTimes";

/** The recorded results of a competition, in the shape its challenge type uses. */
export type RecordedResults = { kind: "fitness_challenge"; scores: SetRepScore[] } | { kind: "speed_fit"; times: EntryTime[] };

export async function listResults({ id, kind }: Pick<Competition, "id" | "kind">): Promise<RecordedResults> {
  return kind === "speed_fit" ? { kind, times: await listTimes(id) } : { kind, scores: await listScores(id) };
}
