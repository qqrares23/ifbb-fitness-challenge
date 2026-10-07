import { describe, expect, it } from "vitest";
import { categoryName, categoryTitle, describeCategoryRules, subgroupName } from "@/lib/labels";
import { validateSubgroup } from "./validateSubgroup";

const form = { format: "individual", gender: "male", minAge: "14", maxAge: "23" } as const;

describe("validateSubgroup", () => {
  it("parses ages, treating blanks as open bounds", () => {
    expect(validateSubgroup(form)).toEqual({ ok: true, value: { format: "individual", gender: "male", minAge: 14, maxAge: 23 } });
    expect(validateSubgroup({ ...form, minAge: " ", maxAge: "" })).toMatchObject({ ok: true, value: { minAge: null, maxAge: null } });
  });

  it("rejects non-integer or out-of-range ages, and min above max", () => {
    expect(validateSubgroup({ ...form, minAge: "16.5" })).toMatchObject({ ok: false, errors: { minAge: expect.any(String) } });
    expect(validateSubgroup({ ...form, maxAge: "121" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
    expect(validateSubgroup({ ...form, minAge: "24" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
  });
});

describe("category naming", () => {
  const juniorMen = { format: "individual", gender: "male", minAge: 14, maxAge: 23 } as const;

  it("names a competition category after its age group, sub-group and level", () => {
    expect(categoryName("Junior", juniorMen, "Gold")).toBe("Junior Men 14–23 · Gold");
    expect(categoryName("Masters", { format: "individual", gender: "female", minAge: 40, maxAge: null }, "Bronze")).toBe("Masters Women 40+ · Bronze");
  });

  it("doesn't repeat what the age group name already says (libraries upgraded from flat categories)", () => {
    const juniors = { format: "individual", gender: "male", minAge: 16, maxAge: 20 } as const;
    expect(subgroupName("Juniors Men 16–20", juniors)).toBe("Juniors Men 16–20");
    expect(subgroupName("Juniors Male 16-20", juniors)).toBe("Juniors Male 16-20");
    expect(subgroupName("Masters 40+", { format: "individual", gender: "female", minAge: 40, maxAge: null })).toBe("Masters 40+ Women");
    // "Women" contains "men", and "116–20" contains "16–20": neither counts as already said.
    expect(subgroupName("Women Open", juniors)).toBe("Women Open Men 16–20");
    expect(subgroupName("Cup 116–20", juniors)).toBe("Cup 116–20 Men 16–20");
  });

  it("names a sub-group without levels after the sub-group alone, and never repeats the level", () => {
    const openMen = { format: "individual", gender: "male", minAge: null, maxAge: null } as const;
    expect(categoryName("Open", openMen, "")).toBe("Open Men");
    expect(categoryName("Junior Gold", juniorMen, "Gold")).toBe("Junior Gold Men 14–23");
    expect(categoryTitle({ ...openMen, name: "x", ageGroup: "Open", level: "" })).toBe("Open Men");
    expect(categoryTitle({ ...juniorMen, name: "x", ageGroup: "Juniors Men 14-23 Gold", level: "Gold" })).toBe("Juniors Men 14-23 Gold");
  });

  it("titles it for official results, without doubling the word Level", () => {
    const base = { ...juniorMen, name: "x", ageGroup: "Junior" };
    expect(categoryTitle({ ...base, level: "Gold" })).toBe("Junior Men 14–23 Gold Level");
    expect(categoryTitle({ ...base, level: "Level 2" })).toBe("Junior Men 14–23 Level 2");
    expect(categoryTitle({ ...base, level: "Elite level" })).toBe("Junior Men 14–23 Elite level");
    expect(categoryTitle({ ...base, ageGroup: "", level: "", name: "Open" })).toBe("Open");
  });

  it("names couples and teams, unless the age group already says so", () => {
    const mixedCouple = { format: "couple", gender: "mixed", minAge: 18, maxAge: null } as const;
    expect(categoryName("Senior", mixedCouple, "Gold")).toBe("Senior Mixed Couple 18+ · Gold");
    expect(subgroupName("Couples", mixedCouple)).toBe("Couples Mixed 18+");
    expect(subgroupName("Open", { format: "team", gender: "female", minAge: null, maxAge: null })).toBe("Open Women Team");
    expect(describeCategoryRules(mixedCouple)).toBe("Couple (2) · Mixed · 18+ years");
  });
});
