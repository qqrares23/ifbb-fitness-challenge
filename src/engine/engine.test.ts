import { describe, expect, it } from "vitest";
import { ageOn, eligibilityProblems, rankCategory, type CategoryRules, type RepScore } from "./index";

describe("ageOn", () => {
  it("counts completed years", () => {
    expect(ageOn("2000-06-15", "2026-06-14")).toBe(25);
    expect(ageOn("2000-06-15", "2026-06-15")).toBe(26);
    expect(ageOn("2000-06-15", "2026-12-31")).toBe(26);
  });

  it("turns a 29 February birthday over on 1 March in non-leap years", () => {
    expect(ageOn("2004-02-29", "2025-02-28")).toBe(20);
    expect(ageOn("2004-02-29", "2025-03-01")).toBe(21);
    expect(ageOn("2004-02-29", "2028-02-29")).toBe(24);
  });

  it("rejects malformed dates", () => {
    expect(() => ageOn("15/06/2000", "2026-01-01")).toThrow();
  });
});

describe("eligibilityProblems", () => {
  const juniorsMen: CategoryRules = { gender: "male", minAge: 16, maxAge: 20 };

  it("accepts an athlete inside every bound, including the inclusive edges", () => {
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2010-03-01" }, juniorsMen, "2026-03-01")).toEqual([]);
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2005-03-02" }, juniorsMen, "2026-03-01")).toEqual([]);
  });

  it("reports wrong sex and age independently", () => {
    const problems = eligibilityProblems({ sex: "female", dateOfBirth: "2012-01-01" }, juniorsMen, "2026-03-01");
    expect(problems).toHaveLength(2);
  });

  it("checks age on the competition date, not today", () => {
    expect(eligibilityProblems({ sex: "male", dateOfBirth: "2010-03-02" }, juniorsMen, "2026-03-01")).toHaveLength(1);
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
