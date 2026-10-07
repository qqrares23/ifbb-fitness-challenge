import { describe, expect, it } from "vitest";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { competitionResults } from "@/features/competitions/standings";
import { resultsCsv, toCsv } from "./csv";
import { exportFileStem, resultsTables } from "./standingsTable";

const entry = (id: number, firstName: string, club = ""): Entry => {
  const athlete = { athleteId: id, firstName, lastName: "Pop", dateOfBirth: "2000-01-01", sex: "male", country: "ROU", club } as const;
  return { ...athlete, id, categoryId: 1, bibNumber: id, lateEntry: false, team: false, members: [athlete] };
};

const setup: CompetitionSetup = {
  competition: { id: 1, name: "Cup", date: "2026-10-01", location: "", kind: "fitness_challenge", status: "finished" },
  stationSets: [
    { id: 1, name: "Set A", stations: [{ stationNumber: 1, exerciseId: 1, exerciseName: "Push-ups" }, { stationNumber: 2, exerciseId: 2, exerciseName: "Squats" }] },
    { id: 2, name: "Set B", stations: [{ stationNumber: 1, exerciseId: 3, exerciseName: "Sit-ups" }] },
  ],
  categories: [{ id: 1, name: "Open", format: "individual", gender: "mixed", minAge: null, maxAge: null, ageGroup: "", level: "", federation: null, stationSetIds: [1] }],
  entries: [entry(1, "Ana"), entry(2, "Ion"), entry(3, "Eva")],
};

const format = { stationHeader: (s: { stationNumber: number }) => `S${s.stationNumber}`, missing: "—" };

describe("resultsTables", () => {
  it("Fitness Challenge: Nr Crt | Athlete Name | Country | stations | Total | Placement, in ranking order", () => {
    const results = competitionResults(setup, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 1, setId: 1, stationNumber: 1, reps: 20 },
        { entryId: 1, setId: 1, stationNumber: 2, reps: 10 },
        { entryId: 2, setId: 1, stationNumber: 1, reps: 30 },
        { entryId: 3, setId: 2, stationNumber: 1, reps: 99 }, // another set: kept, not ranked
      ],
    });
    const [open] = resultsTables(results, format);
    expect(open!.head).toEqual(["Nr Crt", "Athlete Name", "Country", "S1", "S2", "Total", "Placement"]);
    expect(open!.body).toEqual([
      ["1", "Ana Pop", "ROU", "20", "10", "30", "1"],
      ["2", "Ion Pop", "ROU", "30", "—", "30", "2"], // equal total, fewer reps on the last station
      ["3", "Eva Pop", "ROU", "—", "—", "0", "3"],
    ]);
  });

  it("Speed Fit: Nr Crt | Athlete Name | Country | Time | Placement, fastest first, no time last", () => {
    const speedFit = { ...setup, competition: { ...setup.competition, kind: "speed_fit" as const }, stationSets: [] };
    const results = competitionResults(speedFit, { kind: "speed_fit", times: [{ entryId: 2, timeMs: 83_450 }, { entryId: 3, timeMs: 61_000 }] });
    const [open] = resultsTables(results, format);
    expect(open!.head).toEqual(["Nr Crt", "Athlete Name", "Country", "Time", "Placement"]);
    expect(open!.body).toEqual([
      ["1", "Eva Pop", "ROU", "1:01.00", "1"],
      ["2", "Ion Pop", "ROU", "1:23.45", "2"],
      ["3", "Ana Pop", "ROU", "—", "—"],
    ]);
  });
});

describe("station sets in exports", () => {
  it("gives each category the columns of its own set, and repeats the CSV header only where they change", () => {
    const twoSets: CompetitionSetup = {
      ...setup,
      categories: [
        { ...setup.categories[0]!, id: 1, name: "Gold", stationSetIds: [1] },
        { ...setup.categories[0]!, id: 2, name: "Silver", stationSetIds: [1] },
        { ...setup.categories[0]!, id: 3, name: "Bronze", stationSetIds: [2] },
      ],
      entries: [entry(1, "Ana"), { ...entry(2, "Ion"), categoryId: 2 }, { ...entry(3, "Eva"), categoryId: 3 }],
    };
    const results = competitionResults(twoSets, { kind: "fitness_challenge", scores: [{ entryId: 3, setId: 2, stationNumber: 1, reps: 7 }] });
    expect(resultsTables(results, format).map((t) => t.head.slice(3, -2))).toEqual([["S1", "S2"], ["S1", "S2"], ["S1"]]);
    const lines = resultsCsv(results).replace("﻿", "").split("\r\n");
    expect(lines.filter((l) => l.startsWith("Category,"))).toHaveLength(2);
    expect(lines).toContain("Bronze,1,Eva Pop,ROU,7,7,1");
  });
});

describe("several station sets", () => {
  it("exports a table per set and an overall table with the set totals", () => {
    const both: CompetitionSetup = { ...setup, categories: [{ ...setup.categories[0]!, stationSetIds: [1, 2] }] };
    const results = competitionResults(both, {
      kind: "fitness_challenge",
      scores: [
        { entryId: 1, setId: 1, stationNumber: 1, reps: 20 },
        { entryId: 1, setId: 2, stationNumber: 1, reps: 5 },
        { entryId: 2, setId: 2, stationNumber: 1, reps: 30 },
      ],
    });
    const tables = resultsTables(results, format);
    expect(tables.map((t) => t.part)).toEqual(["Set A", "Set B", "Overall"]);
    expect(tables[2]!.head).toEqual(["Nr Crt", "Athlete Name", "Country", "Set A", "Set B", "Total", "Placement"]);
    expect(tables[2]!.body[0]).toEqual(["1", "Ion Pop", "ROU", "—", "30", "30", "1"]);
    expect(resultsCsv(results)).toContain("Open · Overall,1,Ion Pop,ROU,—,30,30,1".replace("—", ""));
  });
});

describe("club column", () => {
  it("appears only for categories where an athlete has a club", () => {
    const speedFit = { ...setup, competition: { ...setup.competition, kind: "speed_fit" as const }, stationSets: [] };
    const withClub = { ...speedFit, entries: [entry(1, "Ana", "CS Dinamo"), entry(2, "Ion")] };
    const [open] = resultsTables(competitionResults(withClub, { kind: "speed_fit", times: [] }), format);
    expect(open!.head).toEqual(["Nr Crt", "Athlete Name", "Country", "Club", "Time", "Placement"]);
    expect(open!.body[0]).toEqual(["1", "Ana Pop", "ROU", "CS Dinamo", "—", "—"]);
    expect(resultsTables(competitionResults(speedFit, { kind: "speed_fit", times: [] }), format)[0]!.head).not.toContain("Club");
  });

  it("is left out of IFBB Fitness Challenge categories, which only show the country", () => {
    const ifbb = { ...setup, categories: [{ ...setup.categories[0]!, federation: "ifbb" as const }], entries: [entry(1, "Ana", "CS Dinamo")] };
    const [open] = resultsTables(competitionResults(ifbb, { kind: "fitness_challenge", scores: [] }), format);
    expect(open!.head).toEqual(["Nr Crt", "Athlete Name", "Country", "S1", "S2", "Total", "Placement"]);
    const romania = { ...ifbb, categories: [{ ...ifbb.categories[0]!, federation: "romania" as const }] };
    expect(resultsTables(competitionResults(romania, { kind: "fitness_challenge", scores: [] }), format)[0]!.head).toContain("Club");
  });
});

describe("couples and teams", () => {
  it("print every athlete's name and each country once, under a Couple / Team header", () => {
    const ana = entry(1, "Ana").members[0]!;
    const ion = { ...entry(2, "Ion").members[0]!, country: "HUN" };
    const couple: Entry = { ...entry(1, "Ana"), team: true, members: [ana, ion] };
    const couples = { ...setup, categories: [{ ...setup.categories[0]!, format: "couple" as const }], entries: [couple] };
    const [open] = resultsTables(competitionResults(couples, { kind: "fitness_challenge", scores: [] }), format);
    expect(open!.head.slice(0, 3)).toEqual(["Nr Crt", "Couple", "Country"]);
    expect(open!.body[0]!.slice(0, 3)).toEqual(["1", "Ana Pop / Ion Pop", "ROU / HUN"]);
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
