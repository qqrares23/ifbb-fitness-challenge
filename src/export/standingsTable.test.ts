import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { competitionResults } from "@/features/competitions/standings";
import { toCsv } from "./csv";
import { exportFileStem, resultsTables } from "./standingsTable";

const entry = (id: number, firstName: string): Entry => ({
  id, athleteId: id, categoryId: 1, bibNumber: id, firstName, lastName: "Pop", dateOfBirth: "2000-01-01", sex: "male", country: "ROU", lateEntry: false,
});

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "finished" },
  stations: [
    { stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" },
    { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" },
  ],
  categories: [{ id: 1, name: "Open", gender: "mixed", minAge: null, maxAge: null }],
  entries: [entry(1, "Ana"), entry(2, "Ion"), entry(3, "Eva")],
};

const format = { stationHeader: (s: { stationNumber: number }) => `S${s.stationNumber}`, missing: "—" };

describe("resultsTables", () => {
  it("Fitness Challenge: Nr Crt | Athlete Name | Country | stations | Placement, in ranking order", () => {
    const results = competitionResults(setup, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 1, stationNumber: 1, reps: 20 },
        { entryId: 1, stationNumber: 2, reps: 10 },
        { entryId: 2, stationNumber: 1, reps: 30 },
      ],
    });
    const { head, categories } = resultsTables(setup, results, format);
    expect(head).toEqual(["Nr Crt", "Athlete Name", "Country", "S1", "S2", "Placement"]);
    expect(categories[0]!.body).toEqual([
      ["1", "Ana Pop", "ROU", "20", "10", "1"],
      ["2", "Ion Pop", "ROU", "30", "—", "1"],
      ["3", "Eva Pop", "ROU", "—", "—", "3"],
    ]);
  });

  it("Speed Fit: Nr Crt | Athlete Name | Country | Time | Placement, fastest first, no time last", () => {
    const speedFit = { ...setup, competition: { ...setup.competition, kind: "speed_fit" as const }, stations: [] };
    const results = competitionResults(speedFit, { kind: "speed_fit", times: [{ entryId: 2, timeMs: 83_450 }, { entryId: 3, timeMs: 61_000 }] });
    const { head, categories } = resultsTables(speedFit, results, format);
    expect(head).toEqual(["Nr Crt", "Athlete Name", "Country", "Time", "Placement"]);
    expect(categories[0]!.body).toEqual([
      ["1", "Eva Pop", "ROU", "1:01.00", "1"],
      ["2", "Ion Pop", "ROU", "1:23.45", "2"],
      ["3", "Ana Pop", "ROU", "—", "—"],
    ]);
  });
});

describe("toCsv", () => {
  it("quotes only what needs quoting and uses CRLF", () => {
    expect(toCsv([["a", "b,c"], ['say "hi"', "line\nbreak"]])).toBe('a,"b,c"\r\n"say ""hi""","line\nbreak"\r\n');
  });

  it("neutralises cells that a spreadsheet would run as a formula", () => {
    expect(toCsv([["=1+1", "-2", "+x", "@y"]])).toBe("'=1+1,-2,'+x,'@y\r\n");
  });
});

describe("exportFileStem", () => {
  it("makes a safe, diacritic-free file name", () => {
    expect(exportFileStem("Cupa României 2026!")).toBe("cupa-romaniei-2026-results");
    expect(exportFileStem("***")).toBe("competition-results");
  });
});
