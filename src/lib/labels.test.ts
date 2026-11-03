import { describe, expect, it } from "vitest";
import { formatDateRange } from "./dates";
import { categorySubtitle } from "./labels";

const category = (level: string) => ({ name: "", ageGroup: "SENIOR", level, format: "individual" as const, gender: "male" as const, minAge: 18, maxAge: null });

describe("categorySubtitle", () => {
  it("names the challenge before the category", () => {
    expect(categorySubtitle({ kind: "fitness_challenge" }, category("Gold"), " Official Results")).toBe("Fitness Challenge — SENIOR Men 18+ Gold Level Official Results");
  });

  it("doesn't name Speed Fit twice when the level already does, however it is spelled", () => {
    expect(categorySubtitle({ kind: "speed_fit" }, category("SPEED FIT"))).toBe("SENIOR Men 18+ SPEED FIT Level");
    expect(categorySubtitle({ kind: "speed_fit" }, category("SPEEDFIT"))).toBe("SENIOR Men 18+ SPEEDFIT Level");
  });
});

describe("formatDateRange", () => {
  it("shows one day, or the first and last", () => {
    expect(formatDateRange("2026-11-12", null)).toBe("12 Nov 2026");
    expect(formatDateRange("2026-11-12", "2026-11-12")).toBe("12 Nov 2026");
    expect(formatDateRange("2026-11-12", "2026-11-14")).toBe("12 Nov 2026 – 14 Nov 2026");
  });
});
