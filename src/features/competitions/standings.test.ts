import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import { groupBySubgroup } from "@/db/categories";
import { competitionResults, entriesWithResults, type CategoryStandings } from "./standings";

const fitnessChallenge = (c: CategoryStandings | undefined) => {
  if (c?.kind !== "fitness_challenge") throw new Error("wrong kind");
  return c;
};

describe("groupBySubgroup", () => {
  it("groups levels under their sub-group in order, keeping pre-hierarchy categories on their own", () => {
    const junior = { ...({ format: "individual", ageGroup: "Junior", gender: "male", minAge: 14, maxAge: 23, federation: null, kind: "fitness_challenge" } as const), stationSetIds: [] as number[] };
    const groups = groupBySubgroup([
      { ...junior, id: 1, name: "Junior Men 14–23 · Bronze", level: "Bronze" },
      { ...junior, id: 2, name: "Junior Women 16–23 · Bronze", level: "Bronze", gender: "female", minAge: 16 },
      { ...junior, id: 3, name: "Junior Men 14–23 · Gold", level: "Gold" },
      { id: 4, name: "Open", format: "individual", gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, kind: "fitness_challenge", stationSetIds: [] },
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
  competition: { id: 1, name: "Cup", date: "2026-10-01", endDate: null, location: "", status: "running" },
  stationSets: [
    { id: 1, name: "Set A", stations: [{ stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" }, { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" }] },
    { id: 2, name: "Set B", stations: [{ stationNumber: 1, exerciseId: 3, exerciseName: "Sit-ups" }] },
  ],
  categories: [
    { id: 10, name: "Men", format: "individual", gender: "male", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, kind: "fitness_challenge", stationSetIds: [1] },
    { id: 11, name: "Empty", format: "individual", gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, kind: "fitness_challenge", stationSetIds: [1] },
  ],
  entries: [
    { ...athlete, id: 102, athleteId: 2, categoryId: 10, bibNumber: 7, members: [] },
    { ...athlete, id: 101, athleteId: 1, categoryId: 10, bibNumber: 3, members: [] },
  ],
};

describe("competitionResults", () => {
  it("Fitness Challenge: ranks each category separately, lists ties by bib and counts missing station results", () => {
    const results = competitionResults(setup, {
      times: [],
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 10 },
        { entryId: 102, setId: 1, stationNumber: 1, reps: 10 },
      ],
    });
    const [men, empty] = results.categories.map(fitnessChallenge);
    expect(men!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[3, 1], [7, 1]]);
    expect(men!.missingResults).toBe(2);
    expect(empty!.rows).toEqual([]);
    expect(men!.rows[0]).toMatchObject({ totalReps: 10, complete: false });
  });

  it("Fitness Challenge: ranks a category on its current set only, keeping reps on other sets aside", () => {
    const onSetB = { ...setup, categories: setup.categories.map((c) => (c.id === 10 ? { ...c, stationSetIds: [2] } : c)) };
    const recorded = {
      times: [],
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 50 }, // Set A, no longer counted
        { entryId: 102, setId: 2, stationNumber: 1, reps: 8 },
      ],
    };
    const results = competitionResults(onSetB, recorded);
    const men = fitnessChallenge(results.categories[0]);
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
      times: [],
      scores: [
        { entryId: 101, setId: 1, stationNumber: 1, reps: 30 }, // bib 3: best on Set A
        { entryId: 102, setId: 1, stationNumber: 1, reps: 10 },
        { entryId: 102, setId: 2, stationNumber: 1, reps: 25 }, // bib 7: 35 overall
      ],
    });
    const men = fitnessChallenge(results.categories[0]);
    const ranking = (rows: typeof men.rows) => rows.map((r) => [r.entry.bibNumber, r.totalReps, r.place]);
    expect(ranking(men.sets[0]!.rows)).toEqual([[3, 30, 1], [7, 10, 2]]);
    expect(ranking(men.sets[1]!.rows)).toEqual([[7, 25, 1], [3, 0, 2]]);
    expect(ranking(men.overall!)).toEqual([[7, 35, 1], [3, 30, 2]]);
    expect(men.overall![1]!.perStation.get(1)).toBeNull(); // bib 3 has no reps on Set B
    expect(men.rows).toBe(men.overall);
    expect(men.missingResults).toBe(3); // Set A station 2 ×2, Set B station 1 for bib 3
  });

  it("Speed Fit: fastest first, athletes without a time last and counted as missing", () => {
    const speedFit = { ...setup, categories: setup.categories.map((c) => ({ ...c, kind: "speed_fit" as const, stationSetIds: [] })), stationSets: [] };
    const results = competitionResults(speedFit, { scores: [], times: [{ entryId: 102, timeMs: 83_450 }] });
    expect(results.categories[0]!.kind).toBe("speed_fit");
    expect(results.categories[0]!.rows.map((r) => [r.entry.bibNumber, r.place])).toEqual([[7, 1], [3, null]]);
    expect(results.categories[0]!.missingResults).toBe(1);
  });

  it("ranks each category of a mixed competition by its own challenge", () => {
    const mixed = { ...setup, categories: [setup.categories[0]!, { ...setup.categories[1]!, kind: "speed_fit" as const, stationSetIds: [] }] };
    mixed.entries = [...setup.entries, { ...setup.entries[0]!, id: 103, categoryId: 11 }]; // bib 7 does both
    const results = competitionResults(mixed, {
      scores: [{ entryId: 102, setId: 1, stationNumber: 1, reps: 12 }],
      times: [{ entryId: 103, timeMs: 61_000 }],
    });
    const [reps, time] = results.categories;
    expect(fitnessChallenge(reps).rows.map((r) => [r.entry.bibNumber, r.totalReps, r.place])).toEqual([[7, 12, 1], [3, 0, 2]]);
    expect(time).toMatchObject({ kind: "speed_fit", missingResults: 0, rows: [{ timeMs: 61_000, place: 1 }] });
  });
});
