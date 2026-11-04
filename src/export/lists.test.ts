import { describe, expect, it } from "vitest";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { competitionResults } from "@/features/competitions/standings";
import { athleteListTable, categoryEntriesTable, placementTable } from "./lists";

const member = (athleteId: number, firstName: string, country: string, club = "") =>
  ({ athleteId, firstName, lastName: "Pop", dateOfBirth: "2000-01-01", sex: "male", country, club }) as const;

const solo = (id: number, categoryId: number, bib: number, m: ReturnType<typeof member>): Entry => ({ ...m, id, categoryId, bibNumber: bib, lateEntry: false, team: false, members: [m] });

const category = (id: number, name: string, format: Category["format"] = "individual"): Category => ({
  id, name, format, gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, kind: "speed_fit", stationSetIds: [],
});

const ana = member(1, "Ana", "ROU", "CS Dinamo");
const ion = member(2, "Ion", "HUN");
const eva = member(3, "Eva", "ROU", "CS Dinamo");

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", endDate: null, location: "", status: "finished" },
  stationSets: [],
  categories: [category(1, "Gold"), category(2, "Silver"), category(3, "Couples", "couple")],
  entries: [
    solo(10, 1, 1, ana),
    solo(11, 1, 2, ion),
    solo(12, 2, 1, ana),
    solo(13, 2, 3, eva),
    { ...solo(14, 3, 9, ion), team: true, members: [ion, eva] },
  ],
};

describe("athleteListTable", () => {
  it("lists each athlete once, by surname, with their own number, full country name and every category", () => {
    const { head, body } = athleteListTable(setup);
    expect(head).toEqual(["Nr", "Athlete", "Sex", "Age", "Country", "Club", "Categories"]);
    expect(body).toEqual([
      ["1", "Pop Ana", "Male", "26", "Romania", "CS Dinamo", "Gold\nSilver"],
      ["3", "Pop Eva", "Male", "26", "Romania", "CS Dinamo", "Silver\nCouples (Nr 9)"],
      ["2", "Pop Ion", "Male", "26", "Hungary", "", "Gold\nCouples (Nr 9)"],
    ]);
  });
});

describe("categoryEntriesTable", () => {
  it("lists a couple with both names and each country once, written out", () => {
    expect(categoryEntriesTable(setup.categories[2]!, setup.entries)).toEqual({
      head: ["Nr", "Couple", "Country", "Club"],
      body: [["9", "Ion Pop / Eva Pop", "Hungary / Romania", "CS Dinamo"]],
    });
  });
});

describe("placementTable", () => {
  const results = competitionResults(setup, {
    scores: [],
    times: [
      { entryId: 10, timeMs: 60_000 }, // Gold: Ana 1st
      { entryId: 11, timeMs: 70_000 }, //       Ion 2nd
      { entryId: 13, timeMs: 50_000 }, // Silver: Eva 1st, Ana (no time) unplaced
      { entryId: 14, timeMs: 80_000 }, // Couples: Ion + Eva 1st, once for each country
    ],
  });

  it("ranks countries by 1st, then 2nd, then 3rd places, using full names", () => {
    expect(placementTable(results, "country")).toEqual([
      { place: 1, name: "Romania", gold: 3, silver: 0, bronze: 0 },
      { place: 2, name: "Hungary", gold: 1, silver: 1, bronze: 0 },
    ]);
  });

  it("ranks clubs, leaving out athletes without one", () => {
    expect(placementTable(results, "club")).toEqual([{ place: 1, name: "CS Dinamo", gold: 3, silver: 0, bronze: 0 }]);
  });

  it("lists everyone who took part, sharing a place on equal counts", () => {
    const none = competitionResults(setup, { scores: [], times: [] });
    expect(placementTable(none, "country").map((r) => [r.place, r.name])).toEqual([[1, "Hungary"], [1, "Romania"]]);
  });
});

describe("placementTable in IFBB Fitness Challenge", () => {
  it("doesn't credit clubs in IFBB categories, whose results show no clubs", () => {
    const fc: CompetitionSetup = {
      ...setup,
      stationSets: [{ id: 1, name: "A", stations: [{ stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" }] }],
      categories: [
        { ...category(1, "IFBB"), kind: "fitness_challenge", federation: "ifbb", stationSetIds: [1] },
        { ...category(2, "Romania"), kind: "fitness_challenge", federation: "romania", stationSetIds: [1] },
      ],
      entries: [solo(10, 1, 1, ana), solo(12, 2, 1, ana)],
    };
    const results = competitionResults(fc, {
      times: [],
      scores: [{ entryId: 10, setId: 1, stationNumber: 1, reps: 10 }, { entryId: 12, setId: 1, stationNumber: 1, reps: 10 }],
    });
    expect(placementTable(results, "club")).toEqual([{ place: 1, name: "CS Dinamo", gold: 1, silver: 0, bronze: 0 }]);
    expect(placementTable(results, "country")).toEqual([{ place: 1, name: "Romania", gold: 2, silver: 0, bronze: 0 }]);
  });
});
