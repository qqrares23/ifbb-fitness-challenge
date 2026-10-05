import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import { competitionResults, leaderboardRows } from "./standings";

const athlete = { firstName: "A", lastName: "B", dateOfBirth: "2000-01-01", sex: "male", country: "ROU" } as const;

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "running" },
  stations: [
    { stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" },
    { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" },
  ],
  categories: [
    { id: 10, name: "Men", gender: "male", minAge: null, maxAge: null },
    { id: 11, name: "Empty", gender: "mixed", minAge: null, maxAge: null },
  ],
  entries: [
    { ...athlete, id: 102, athleteId: 2, categoryId: 10, bibNumber: 7 },
    { ...athlete, id: 101, athleteId: 1, categoryId: 10, bibNumber: 3 },
  ],
};

describe("competitionResults", () => {
  it("Fitness Challenge: ranks each category separately, lists ties by bib and counts missing station results", () => {
    const results = competitionResults(setup, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 101, stationNumber: 1, reps: 10 },
        { entryId: 102, stationNumber: 1, reps: 10 },
      ],
    });
    if (results.kind !== "fitness_challenge") throw new Error("wrong kind");
    const [men, empty] = results.categories;
    expect(men!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[3, 1], [7, 1]]);
    expect(men!.missingResults).toBe(2);
    expect(empty!.rows).toEqual([]);
    expect(leaderboardRows(results, 0)[0]).toMatchObject({ place: 1, value: "10", note: "Results incomplete" });
  });

  it("Speed Fit: fastest first, athletes without a time last and counted as missing", () => {
    const results = competitionResults({ ...setup, stations: [] }, { kind: "speed_fit", times: [{ entryId: 102, timeMs: 83_450 }] });
    if (results.kind !== "speed_fit") throw new Error("wrong kind");
    expect(results.categories[0]!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[7, 1], [3, null]]);
    expect(results.categories[0]!.missingResults).toBe(1);
    expect(leaderboardRows(results, 0).map((r) => r.value)).toEqual(["1:23.45", "—"]);
  });
});
