import { describe, expect, it } from "vitest";
import { canChangeCategory, competitionPermissions } from "./permissions";

describe("competitionPermissions", () => {
  it("keeps the setup (stations, categories, athletes) editable while running, but not the details", () => {
    expect(competitionPermissions("running")).toEqual({ editDetails: false, editSetup: true, enterResults: true, clearResults: true, restart: true });
  });

  it("freezes everything once finished, except a restart", () => {
    const { restart, ...rest } = competitionPermissions("finished");
    expect(restart).toBe(true);
    expect(Object.values(rest).some(Boolean)).toBe(false);
  });

  it("has nothing to restart or clear in draft", () => {
    expect(competitionPermissions("draft")).toMatchObject({ clearResults: false, restart: false });
  });

  it("lets an athlete change category only until they have results", () => {
    expect(canChangeCategory(competitionPermissions("running"), false)).toBe(true);
    expect(canChangeCategory(competitionPermissions("running"), true)).toBe(false);
    expect(canChangeCategory(competitionPermissions("finished"), false)).toBe(false);
  });
});
