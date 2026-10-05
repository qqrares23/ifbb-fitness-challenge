import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import { competitionReadiness } from "./readiness";

const ready: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "draft" },
  stations: [
    { stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" },
    { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" },
  ],
  categories: [{ id: 10, name: "Juniors", gender: "male", minAge: 16, maxAge: 20 }],
  entries: [
    { id: 100, athleteId: 1, categoryId: 10, bibNumber: 1, firstName: "Ion", lastName: "Pop", dateOfBirth: "2008-01-01", sex: "male", country: "ROU" },
  ],
};

describe("competitionReadiness", () => {
  it("has nothing to report for a complete setup", () => {
    expect(competitionReadiness(ready)).toEqual({ blocking: [], warnings: [] });
  });

  it("blocks without stations or athletes", () => {
    const { blocking } = competitionReadiness({ ...ready, stations: [], entries: [] });
    expect(blocking).toHaveLength(2);
  });

  it("doesn't ask a Speed Fit competition for stations", () => {
    const speedFit = { ...ready, competition: { ...ready.competition, kind: "speed_fit" as const }, stations: [] };
    expect(competitionReadiness(speedFit).blocking).toEqual([]);
  });

  it("blocks on stations without an exercise, listed together", () => {
    const stations = ready.stations.map((s) => ({ ...s, exerciseId: null, exerciseName: null }));
    expect(competitionReadiness({ ...ready, stations }).blocking).toEqual(["Pick an exercise for stations 1, 2."]);
  });

  it("blocks on an athlete who no longer fits their category", () => {
    const categories = [{ ...ready.categories[0]!, gender: "female" as const }];
    expect(competitionReadiness({ ...ready, categories }).blocking).toHaveLength(1);
  });

  it("warns about empty categories and a repeated exercise", () => {
    const { blocking, warnings } = competitionReadiness({
      ...ready,
      stations: [...ready.stations, { stationNumber: 3, exerciseId: 1, exerciseName: "Push-ups" }],
      categories: [...ready.categories, { id: 11, name: "Masters", gender: "mixed", minAge: 40, maxAge: null }],
    });
    expect(blocking).toEqual([]);
    expect(warnings).toHaveLength(2);
  });
});
