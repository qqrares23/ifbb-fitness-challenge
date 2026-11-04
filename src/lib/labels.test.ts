import { describe, expect, it } from "vitest";
import { formatDateRange } from "./dates";
import { categorySubtitle, competitionTitle } from "./labels";

const category = (level: string, kind: "fitness_challenge" | "speed_fit" = "speed_fit") => ({ name: "", ageGroup: "SENIOR", level, kind, format: "individual" as const, gender: "male" as const, minAge: 18, maxAge: null });

describe("categorySubtitle", () => {
  it("names the challenge before the category", () => {
    expect(categorySubtitle(category("Gold", "fitness_challenge"), " Official Results")).toBe("Fitness Challenge — SENIOR Men 18+ Gold Level Official Results");
  });

  it("doesn't name Speed Fit twice when the level already does, however it is spelled", () => {
    expect(categorySubtitle(category("SPEED FIT"))).toBe("SENIOR Men 18+ SPEED FIT Level");
    expect(categorySubtitle(category("SPEEDFIT"))).toBe("SENIOR Men 18+ SPEEDFIT Level");
  });
});

describe("formatDateRange", () => {
  it("shows one day, or the first and last", () => {
    expect(formatDateRange("2026-11-12", null)).toBe("12/11/2026");
    expect(formatDateRange("2026-11-12", "2026-11-12")).toBe("12/11/2026");
    expect(formatDateRange("2026-11-12", "2026-11-14")).toBe("12/11/2026 – 14/11/2026");
  });
});

describe("competitionTitle", () => {
  it("names the challenge only when every category has the same one", () => {
    expect(competitionTitle([{ kind: "speed_fit" }, { kind: "speed_fit" }], "Athletes")).toBe("Speed Fit — Athletes");
    expect(competitionTitle([{ kind: "speed_fit" }, { kind: "fitness_challenge" }], "Athletes")).toBe("Athletes");
  });
});
