import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import { groupBySubgroup } from "@/db/categories";
import { competitionResults, entriesWithResults } from "./standings";

describe("groupBySubgroup", () => {
  it("groups levels under their sub-group in order, keeping pre-hierarchy categories on their own", () => {
    const junior = { ...({ format: "individual", ageGroup: "Junior", gender: "male", minAge: 14, maxAge: 23, federation: null } as const), stationSetIds: [] as number[] };
    const groups = groupBySubgroup([
      { ...junior, id: 1, name: "Junior Men 14–23 · Bronze", level: "Bronze" },
      { ...junior, id: 2, name: "Junior Women 16–23 · Bronze", level: "Bronze", gender: "female", minAge: 16 },
      { ...junior, id: 3, name: "Junior Men 14–23 · Gold", level: "Gold" },
      { id: 4, name: "Open", format: "individual", gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, stationSetIds: [] },
    ]);
    expect(groups.map((g) => [g.label, g.categoryIndexes])).toEqual([
      ["Junior Men 14–23", [0, 2]],
      ["Junior Women 16–23", [1]],
      ["Open", [3]],
    ]);
  });
});

const athlete = { firstName: "A", lastName: "B", dateOfBirth: "2000-01-01", sex: "male", country: "ROU", club: "", lateEntry: false, team: false } as const;

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "running" },
  stationSets: [
    { id: 1, name: "Set A", stations: [{ stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" }, { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" }] },
    { id: 2, name: "Set B", stations: [{ stationNumber: 1, exerciseId: 3, exerciseName: "Sit-ups" }] },
  ],
  categories: [
    { id: 10, name: "Men", format: "individual", gender: "male", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, stationSetIds: [1] },
    { id: 11, name: "Empty", format: "individual", gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, stationSetIds: [1] },
  ],
  entries: [
    { ...athlete, id: 102, athleteId: 2, categoryId: 10, bibNumber: 7, members: [] },
    { ...athlete, id: 101, athleteId: 1, categoryId: 10, bibNumber: 3, members: [] },
  ],
};

describe("competitionResults", () => {
  it("Fitness Challenge: ranks each category separately, lists ties by bib and counts missing station results", () => {
    const results = competitionResults(setup, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 10 },
        { entryId: 102, setId: 1, stationNumber: 1, reps: 10 },
      ],
    });
    if (results.kind !== "fitness_challenge") throw new Error("wrong kind");
    const [men, empty] = results.categories;
    expect(men!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[3, 1], [7, 1]]);
    expect(men!.missingResults).toBe(2);
    expect(empty!.rows).toEqual([]);
    expect(men!.rows[0]).toMatchObject({ totalReps: 10, complete: false });
  });

  it("Fitness Challenge: ranks a category on its current set only, keeping reps on other sets aside", () => {
    const onSetB = { ...setup, categories: setup.categories.map((c) => (c.id === 10 ? { ...c, stationSetIds: [2] } : c)) };
    const recorded = {
      kind: "fitness_challenge" as const,
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 50 }, // Set A, no longer counted
        { entryId: 102, setId: 2, stationNumber: 1, reps: 8 },
      ],
    };
    const results = competitionResults(onSetB, recorded);
    if (results.kind !== "fitness_challenge") throw new Error("wrong kind");
    const men = results.categories[0]!;
    expect(men.sets.map((s) => s.stationSet.name)).toEqual(["Set B"]);
    expect(men.overall).toBeNull();
    expect(men.rows.map((r) => [r.entry.bibNumber, r.totalReps, r.place])).toEqual([[7, 8, 1], [3, 0, 2]]);
    expect(men.missingResults).toBe(1);
    // Results on any set still count as "has results" (category can't change, removal deletes them).
    expect([...entriesWithResults(recorded)].sort()).toEqual([101, 102]);
  });

  it("Fitness Challenge: with several sets, ranks each set and overall by the sum of the set totals", () => {
    const both = { ...setup, categories: setup.categories.map((c) => (c.id === 10 ? { ...c, stationSetIds: [1, 2] } : c)) };
    const results = competitionResults(both, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 30 }, // bib 3: best on Set A
        { entryId: 102, setId: 1, stationNumber: 1, reps: 10 },
        { entryId: 102, setId: 2, stationNumber: 1, reps: 25 }, // bib 7: 35 overall
      ],
    });
    if (results.kind !== "fitness_challenge") throw new Error("wrong kind");
    const men = results.categories[0]!;
    const ranking = (rows: typeof men.rows) => rows.map((r) => [r.entry.bibNumber, r.totalReps, r.place]);
    expect(ranking(men.sets[0]!.rows)).toEqual([[3, 30, 1], [7, 10, 2]]);
    expect(ranking(men.sets[1]!.rows)).toEqual([[7, 25, 1], [3, 0, 2]]);
    expect(ranking(men.overall!)).toEqual([[7, 35, 1], [3, 30, 2]]);
    expect(men.overall![1]!.perStation.get(1)).toBeNull(); // bib 3 has no reps on Set B
    expect(men.rows).toBe(men.overall);
    expect(men.missingResults).toBe(3); // Set A station 2 ×2, Set B station 1 for bib 3
  });

  it("Speed Fit: fastest first, athletes without a time last and counted as missing", () => {
    const results = competitionResults({ ...setup, stationSets: [] }, { kind: "speed_fit", times: [{ entryId: 102, timeMs: 83_450 }] });
    if (results.kind !== "speed_fit") throw new Error("wrong kind");
    expect(results.categories[0]!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[7, 1], [3, null]]);
    expect(results.categories[0]!.missingResults).toBe(1);
  });
});
