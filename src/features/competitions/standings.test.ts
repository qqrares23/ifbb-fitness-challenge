import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import { competitionStandings } from "./standings";

const athlete = { firstName: "A", lastName: "B", dateOfBirth: "2000-01-01", sex: "male", country: "ROU" } as const;

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", status: "running" },
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

describe("competitionStandings", () => {
  it("ranks each category separately, lists ties by bib and counts missing results", () => {
    const [men, empty] = competitionStandings(setup, [
      { entryId: 101, stationNumber: 1, reps: 10 },
      { entryId: 102, stationNumber: 1, reps: 10 },
    ]);
    expect(men!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[3, 1], [7, 1]]);
    expect(men!.missingResults).toBe(2);
    expect(empty!.rows).toEqual([]);
    expect(empty!.missingResults).toBe(0);
  });
});
