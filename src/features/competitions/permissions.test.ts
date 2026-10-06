import { describe, expect, it } from "vitest";
import { canChangeCategory, competitionPermissions } from "./permissions";

describe("competitionPermissions", () => {
  it("keeps the setup (stations, categories, athletes) editable while running, but not the details", () => {
    expect(competitionPermissions("running")).toEqual({ editDetails: false, editSetup: true, enterResults: true });
  });

  it("freezes everything once finished", () => {
    expect(Object.values(competitionPermissions("finished")).some(Boolean)).toBe(false);
  });

  it("lets an athlete change category only until they have results", () => {
    expect(canChangeCategory(competitionPermissions("running"), false)).toBe(true);
    expect(canChangeCategory(competitionPermissions("running"), true)).toBe(false);
    expect(canChangeCategory(competitionPermissions("finished"), false)).toBe(false);
  });
});
