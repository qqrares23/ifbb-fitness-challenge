import { describe, expect, it } from "vitest";
import { categoryName, categoryTitle } from "@/lib/labels";
import { validateSubgroup } from "./validateSubgroup";

const form = { gender: "male", minAge: "14", maxAge: "23" } as const;

describe("validateSubgroup", () => {
  it("parses ages, treating blanks as open bounds", () => {
    expect(validateSubgroup(form)).toEqual({ ok: true, value: { gender: "male", minAge: 14, maxAge: 23 } });
    expect(validateSubgroup({ ...form, minAge: " ", maxAge: "" })).toMatchObject({ ok: true, value: { minAge: null, maxAge: null } });
  });

  it("rejects non-integer or out-of-range ages, and min above max", () => {
    expect(validateSubgroup({ ...form, minAge: "16.5" })).toMatchObject({ ok: false, errors: { minAge: expect.any(String) } });
    expect(validateSubgroup({ ...form, maxAge: "121" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
    expect(validateSubgroup({ ...form, minAge: "24" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
  });
});

describe("category naming", () => {
  const juniorMen = { gender: "male", minAge: 14, maxAge: 23 } as const;

  it("names a competition category after its age group, sub-group and level", () => {
    expect(categoryName("Junior", juniorMen, "Gold")).toBe("Junior Men 14–23 · Gold");
    expect(categoryName("Masters", { gender: "female", minAge: 40, maxAge: null }, "Bronze")).toBe("Masters Women 40+ · Bronze");
  });

  it("titles it for official results, without doubling the word Level", () => {
    const base = { ...juniorMen, name: "x", ageGroup: "Junior" };
    expect(categoryTitle({ ...base, level: "Gold" })).toBe("Junior Men 14–23 Gold Level");
    expect(categoryTitle({ ...base, level: "Level 2" })).toBe("Junior Men 14–23 Level 2");
    expect(categoryTitle({ ...base, level: "Elite level" })).toBe("Junior Men 14–23 Elite level");
    expect(categoryTitle({ ...base, ageGroup: "", level: "", name: "Open" })).toBe("Open");
  });
});
