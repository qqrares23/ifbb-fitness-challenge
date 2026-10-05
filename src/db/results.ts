import type { EntryTime, RepScore } from "@/engine";
import type { Competition } from "./competitions";
import { listScores } from "./scores";
import { listTimes } from "./speedFitTimes";

/** The recorded results of a competition, in the shape its challenge type uses. */
export type RecordedResults = { kind: "fitness_challenge"; scores: RepScore[] } | { kind: "speed_fit"; times: EntryTime[] };

export async function listResults({ id, kind }: Pick<Competition, "id" | "kind">): Promise<RecordedResults> {
  return kind === "speed_fit" ? { kind, times: await listTimes(id) } : { kind, scores: await listScores(id) };
}
