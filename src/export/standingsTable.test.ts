import { describe, expect, it } from "vitest";
import type { Entry } from "@/db/entries";
import type { CategoryStandings } from "@/features/competitions/standings";
import { buildStandingsTable, exportFileStem } from "./standingsTable";
import { toCsv } from "./csv";

const entry = (id: number, firstName: string): Entry => ({
  id, athleteId: id, categoryId: 1, bibNumber: id, firstName, lastName: "Pop", dateOfBirth: "2000-01-01", sex: "male", country: "ROU",
});

const standings: CategoryStandings = {
  category: { id: 1, name: "Open", gender: "mixed", minAge: null, maxAge: null },
  missingResults: 1,
  rows: [
    { entry: entry(1, "Ana"), totalReps: 30, complete: true, place: 1, perStation: new Map([[1, 20], [2, 10]]) },
    { entry: entry(2, "Ion"), totalReps: 30, complete: false, place: 1, perStation: new Map([[1, 30], [2, null]]) },
  ],
};

const stations = [
  { stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" },
  { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" },
];

describe("buildStandingsTable", () => {
  it("uses the Nr Crt | Athlete Name | Country | stations | Placement layout, in ranking order", () => {
    const table = buildStandingsTable(standings, stations, { stationHeader: (s) => `S${s.stationNumber}`, missingReps: "—" });
    expect(table.head).toEqual(["Nr Crt", "Athlete Name", "Country", "S1", "S2", "Placement"]);
    expect(table.body).toEqual([
      ["1", "Ana Pop", "ROU", "20", "10", "1"],
      ["2", "Ion Pop", "ROU", "30", "—", "1"],
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
