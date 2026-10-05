// Every cached query lives under one of these roots; mutations invalidate by root.
// Competition data (setup, entries, scores) all lives under `competitions`, and it embeds
// athlete and exercise names, so writes to those also invalidate `competitions`.
export const queryKeys = {
  athletes: ["athletes"],
  exercises: ["exercises"],
  competitions: ["competitions"],
  competition: (id: number) => ["competitions", id],
  // Nested under the competition so anything that refreshes a competition refreshes its scores too,
  // while a rep save refreshes only the scores.
  competitionScores: (id: number) => ["competitions", id, "scores"],
} as const;
