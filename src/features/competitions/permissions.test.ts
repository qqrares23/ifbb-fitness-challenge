import { describe, expect, it } from "vitest";
import { canChangeCategory, canRemoveCategory, competitionPermissions } from "./permissions";

describe("competitionPermissions", () => {
  it("allows late entries and categories while running, but not setup changes", () => {
    expect(competitionPermissions("running")).toEqual({ editSetup: false, editEntries: true, addCategories: true, enterResults: true });
  });

  it("freezes everything once finished", () => {
    expect(Object.values(competitionPermissions("finished")).some(Boolean)).toBe(false);
  });

  it("removes categories before the start, or empty ones while running", () => {
    expect(canRemoveCategory(competitionPermissions("draft"), 5)).toBe(true);
    expect(canRemoveCategory(competitionPermissions("running"), 0)).toBe(true);
    expect(canRemoveCategory(competitionPermissions("running"), 1)).toBe(false);
    expect(canRemoveCategory(competitionPermissions("finished"), 0)).toBe(false);
  });

  it("lets an athlete change category only until they have results", () => {
    expect(canChangeCategory(competitionPermissions("running"), false)).toBe(true);
    expect(canChangeCategory(competitionPermissions("running"), true)).toBe(false);
    expect(canChangeCategory(competitionPermissions("finished"), false)).toBe(false);
  });
});
