import { describe, expect, it } from "vitest";
import { validateAthlete } from "./validateAthlete";

const valid = { firstName: "Ana", lastName: "Pop", dateOfBirth: "2001-05-04", sex: "female", country: "ROU", club: "" } as const;

describe("validateAthlete", () => {
  it("accepts a complete athlete", () => {
    expect(validateAthlete(valid, "2026-10-05")).toEqual({});
  });

  it("flags blank names and a missing country", () => {
    const errors = validateAthlete({ ...valid, firstName: "  ", lastName: "", country: "" }, "2026-10-05");
    expect(Object.keys(errors).sort()).toEqual(["country", "firstName", "lastName"]);
  });

  it("rejects a missing, future or implausible date of birth", () => {
    expect(validateAthlete({ ...valid, dateOfBirth: "" }, "2026-10-05").dateOfBirth).toBeDefined();
    expect(validateAthlete({ ...valid, dateOfBirth: "2026-10-06" }, "2026-10-05").dateOfBirth).toBeDefined();
    expect(validateAthlete({ ...valid, dateOfBirth: "1899-12-31" }, "2026-10-05").dateOfBirth).toBeDefined();
    expect(validateAthlete({ ...valid, dateOfBirth: "2026-10-05" }, "2026-10-05").dateOfBirth).toBeUndefined();
  });
});
