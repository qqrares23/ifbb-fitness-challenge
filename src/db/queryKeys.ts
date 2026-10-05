// Every cached query lives under one of these roots; mutations invalidate by root.
// Competition data (setup, entries, results) all lives under `competitions`, and it embeds
// athlete and exercise names, so writes to those also invalidate `competitions`.
export const queryKeys = {
  athletes: ["athletes"],
  exercises: ["exercises"],
  competitions: ["competitions"],
  competition: (id: number) => ["competitions", id],
  // Nested under the competition so anything that refreshes a competition refreshes its results
  // too, while a single rep / time save refreshes only the results.
  competitionResults: (id: number) => ["competitions", id, "results"],
} as const;
