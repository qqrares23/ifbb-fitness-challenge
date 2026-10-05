import { describe, expect, it } from "vitest";
import { validateCategory } from "./validateCategory";

const form = { name: "Juniors", gender: "male", minAge: "16", maxAge: "20" } as const;

describe("validateCategory", () => {
  it("parses ages, treating blanks as open bounds", () => {
    expect(validateCategory(form)).toEqual({ ok: true, value: { name: "Juniors", gender: "male", minAge: 16, maxAge: 20 } });
    expect(validateCategory({ ...form, minAge: " ", maxAge: "" })).toMatchObject({ ok: true, value: { minAge: null, maxAge: null } });
  });

  it("rejects a blank name, non-integer or out-of-range ages, and min above max", () => {
    expect(validateCategory({ ...form, name: "" })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(validateCategory({ ...form, minAge: "16.5" })).toMatchObject({ ok: false, errors: { minAge: expect.any(String) } });
    expect(validateCategory({ ...form, maxAge: "121" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
    expect(validateCategory({ ...form, minAge: "21" })).toMatchObject({ ok: false, errors: { maxAge: expect.any(String) } });
  });
});
