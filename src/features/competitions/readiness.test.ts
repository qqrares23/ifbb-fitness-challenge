import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import type { StationSet } from "@/db/stations";
import { competitionReadiness, entryProblems } from "./readiness";

const setA: StationSet = {
  id: 1,
  name: "Set A",
  stations: [
    { stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" },
    { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" },
  ],
};

const ion = { athleteId: 1, firstName: "Ion", lastName: "Pop", dateOfBirth: "2008-01-01", sex: "male", country: "ROU", club: "" } as const;

const ready: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "draft" },
  stationSets: [setA],
  categories: [{ id: 10, name: "Juniors", format: "individual", gender: "male", minAge: 16, maxAge: 20, ageGroup: "", level: "", federation: null, stationSetIds: [1] }],
  entries: [
    { id: 100, categoryId: 10, bibNumber: 1, lateEntry: false, team: false, ...ion, members: [ion] },
  ],
};

describe("competitionReadiness", () => {
  it("has nothing to report for a complete setup", () => {
    expect(competitionReadiness(ready)).toEqual({ blocking: [], warnings: [] });
  });

  it("blocks without stations or athletes", () => {
    const { blocking } = competitionReadiness({ ...ready, stationSets: [{ ...setA, stations: [] }], entries: [] });
    expect(blocking).toEqual(["Set the number of stations.", "Enter at least one athlete."]);
  });

  it("doesn't ask a Speed Fit competition for stations", () => {
    const speedFit = { ...ready, competition: { ...ready.competition, kind: "speed_fit" as const }, stationSets: [] };
    expect(competitionReadiness({ ...speedFit, categories: [{ ...ready.categories[0]!, stationSetIds: [] }] }).blocking).toEqual([]);
  });

  it("blocks on stations without an exercise, listed together", () => {
    const stations = setA.stations.map((s) => ({ ...s, exerciseId: null, exerciseName: null }));
    expect(competitionReadiness({ ...ready, stationSets: [{ ...setA, stations }] }).blocking).toEqual(["Pick an exercise for stations 1, 2."]);
  });

  it("names the set when there are several, blocks a category without a set, and warns about an unused set", () => {
    const setB: StationSet = { id: 2, name: "Set B", stations: [{ stationNumber: 1, exerciseId: null, exerciseName: null }] };
    const { blocking, warnings } = competitionReadiness({ ...ready, stationSets: [setA, setB], categories: [{ ...ready.categories[0]!, stationSetIds: [] }] });
    expect(blocking).toEqual(["Pick an exercise for Set B station 1.", 'Pick a station set for "Juniors".']);
    expect(warnings).toEqual(["No category uses Set A.", "No category uses Set B."]);
  });

  it("blocks on an athlete who no longer fits their category", () => {
    const categories = [{ ...ready.categories[0]!, gender: "female" as const }];
    expect(competitionReadiness({ ...ready, categories }).blocking).toHaveLength(1);
  });

  it("checks a couple / team: its number of athletes, and each athlete against the rules", () => {
    const ana = { ...ion, athleteId: 2, firstName: "Ana", sex: "female" } as const;
    const couples = [{ ...ready.categories[0]!, format: "couple" as const, gender: "mixed" as const }];
    expect(entryProblems({ ...ready.entries[0]!, team: true, members: [ion, ana] }, couples[0]!, "2026-10-01")).toEqual([]);
    expect(entryProblems({ ...ready.entries[0]!, team: true, members: [ion] }, couples[0]!, "2026-10-01")).toEqual([
      "A couple has 2 athletes; this one has 1.",
    ]);
    const menCouples = { ...couples[0]!, gender: "male" as const };
    expect(entryProblems({ ...ready.entries[0]!, team: true, members: [ion, ana] }, menCouples, "2026-10-01")).toEqual([
      "Ana Pop: Category is for male athletes only.",
    ]);
  });

  it("warns about empty categories and a repeated exercise", () => {
    const { blocking, warnings } = competitionReadiness({
      ...ready,
      stationSets: [{ ...setA, stations: [...setA.stations, { stationNumber: 3, exerciseId: 1, exerciseName: "Push-ups" }] }],
      categories: [...ready.categories, { id: 11, name: "Masters", format: "individual", gender: "mixed", minAge: 40, maxAge: null, ageGroup: "", level: "", federation: null, stationSetIds: [1] }],
    });
    expect(blocking).toEqual([]);
    expect(warnings).toEqual(['"Push-ups" is used at stations 1, 3.', '"Masters" has no athletes.']);
  });
});
