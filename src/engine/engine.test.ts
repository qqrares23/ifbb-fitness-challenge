import { describe, expect, it } from "vitest";
import {
  ageOn,
  assignPlaces,
  eligibilityProblems,
  formatDuration,
  parseDuration,
  rankByTime,
  rankCategory,
  type CategoryRules,
  type RepScore,
} from "./index";

describe("ageOn", () => {
  it("is the year of the date minus the year of birth, ignoring month and day", () => {
    expect(ageOn("2000-12-31", "2026-01-01")).toBe(26);
    expect(ageOn("2000-01-01", "2026-12-31")).toBe(26);
    expect(ageOn("2004-02-29", "2025-02-28")).toBe(21);
  });

  it("rejects malformed dates", () => {
    expect(() => ageOn("15/06/2000", "2026-01-01")).toThrow();
  });
});

describe("eligibilityProblems", () => {
  const juniorsMen: CategoryRules = { gender: "male", minAge: 16, maxAge: 20 };

  it("accepts an athlete inside every bound, including the inclusive edges", () => {
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2010-12-31" }, juniorsMen, "2026-03-01")).toEqual([]);
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2006-01-01" }, juniorsMen, "2026-03-01")).toEqual([]);
  });

  it("reports wrong sex and age independently", () => {
    const problems = eligibilityProblems({ sex: "female", dateOfBirth: "2012-01-01" }, juniorsMen, "2026-03-01");
    expect(problems).toHaveLength(2);
  });

  it("uses the competition's year, not today's", () => {
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2010-06-01" }, juniorsMen, "2026-03-01")).toEqual([]);
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2010-06-01" }, juniorsMen, "2025-12-31")).toHaveLength(1);
  });

  it("lets anyone into a mixed, open category", () => {
    const open: CategoryRules = { gender: "mixed", minAge: null, maxAge: null };
    expect(eligibilityProblems({ sex: "female", dateOfBirth: "1950-01-01" }, open, "2026-03-01")).toEqual([]);
  });
});

describe("rankCategory", () => {
  const entries = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const stations = [1, 2];
  const score = (entryId: number, stationNumber: number, reps: number): RepScore => ({ entryId, stationNumber, reps });

  it("ranks by total reps, highest first", () => {
    const rows = rankCategory(entries, stations, [
      score(1, 1, 10), score(1, 2, 10),
      score(2, 1, 30), score(2, 2, 5),
      score(3, 1, 15), score(3, 2, 15),
      score(4, 1, 1), score(4, 2, 1),
    ]);
    expect(rows.map((r) => [r.entry.id, r.totalReps, r.place])).toEqual([
      [2, 35, 1], [3, 30, 2], [1, 20, 3], [4, 2, 4],
    ]);
  });

  it("shares a place on equal totals and skips the next one (1, 1, 3)", () => {
    const rows = rankCategory(entries, stations, [
      score(1, 1, 20), score(2, 1, 20), score(3, 1, 5), score(4, 1, 5),
    ]);
    expect(rows.map((r) => r.place)).toEqual([1, 1, 3, 3]);
  });

  it("breaks equal totals on the last station, then the one before it", () => {
    const six = [1, 2, 3, 4, 5, 6];
    const reps = (id: number, perStation: number[]) => perStation.map((r, i) => score(id, i + 1, r));
    const rows = rankCategory(entries, six, [
      ...reps(1, [10, 10, 10, 10, 10, 10]), // 60, equal to 4 everywhere: shares the place
      ...reps(2, [10, 10, 10, 10, 9, 11]), // 60, most on station 6: wins
      ...reps(3, [9, 10, 10, 10, 11, 10]), // 60, ties on 6, beats 1 and 4 on station 5
      ...reps(4, [10, 10, 10, 10, 10, 10]),
    ]);
    expect(rows.map((r) => [r.entry.id, r.place])).toEqual([[2, 1], [3, 2], [1, 3], [4, 3]]);
  });

  it("keeps tied rows in input order", () => {
    const rows = rankCategory([{ id: 9 }, { id: 3 }, { id: 5 }], [1], []);
    expect(rows.map((r) => r.entry.id)).toEqual([9, 3, 5]);
    expect(rows.every((r) => r.place === 1)).toBe(true);
  });

  it("marks missing stations as null, counts them as 0, and flags the row incomplete", () => {
    const [row] = rankCategory([{ id: 1 }], stations, [score(1, 2, 12)]);
    expect(row!.perStation.get(1)).toBeNull();
    expect(row!.perStation.get(2)).toBe(12);
    expect(row!.totalReps).toBe(12);
    expect(row!.complete).toBe(false);
  });

  it("treats a recorded 0 as complete", () => {
    const [row] = rankCategory([{ id: 1 }], [1], [score(1, 1, 0)]);
    expect(row!.complete).toBe(true);
  });

  it("ignores scores for unknown entries or stations", () => {
    const [row] = rankCategory([{ id: 1 }], [1], [score(1, 1, 5), score(1, 7, 100), score(99, 1, 100)]);
    expect(row!.totalReps).toBe(5);
  });

  it("returns the caller's entry object untouched", () => {
    const athlete = { id: 1, name: "A" };
    expect(rankCategory([athlete], [1], [])[0]!.entry).toBe(athlete);
  });
});

describe("assignPlaces", () => {
  it("shares places on equal scores and skips the next ones", () => {
    const desc = (a: number, b: number) => b - a;
    expect(assignPlaces([9, 7, 7, 7, 3], desc)).toEqual([1, 2, 2, 2, 5]);
    expect(assignPlaces([], desc)).toEqual([]);
  });
});

describe("rankByTime", () => {
  const entries = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  it("ranks fastest first, shares places on equal times and lists athletes without a time last, unplaced", () => {
    const rows = rankByTime(entries, [
      { entryId: 1, timeMs: 95_000 },
      { entryId: 2, timeMs: 80_000 },
      { entryId: 4, timeMs: 80_000 },
    ]);
    expect(rows.map((r) => [r.entry.id, r.place])).toEqual([[2, 1], [4, 1], [1, 3], [3, null]]);
  });
});

describe("parseDuration / formatDuration", () => {
  it("reads seconds, m:ss and h:mm:ss with up to hundredths", () => {
    expect(parseDuration("83.4")).toBe(83_400);
    expect(parseDuration("1:23.45")).toBe(83_450);
    expect(parseDuration(" 01:23 ")).toBe(83_000);
    expect(parseDuration("1:02:03,5")).toBe(3_723_500);
    expect(parseDuration("90")).toBe(90_000);
    expect(parseDuration("23:59:59.99")).toBe(86_399_990); // exactly MAX_TIME_MS, must be accepted
  });

  it("rejects malformed, zero, overflowing or over-precise times", () => {
    for (const bad of ["", "abc", "1:60", "1:60:00", "0", "0:00.00", "1.234", "1:2:3:4", "24:00:00"]) {
      expect(parseDuration(bad), bad).toBeUndefined();
    }
  });

  it("formats and round-trips", () => {
    expect(formatDuration(83_450)).toBe("1:23.45");
    expect(formatDuration(5_000)).toBe("0:05.00");
    expect(formatDuration(3_723_500)).toBe("1:02:03.50");
    expect(parseDuration(formatDuration(3_723_500))).toBe(3_723_500);
  });
});
