import { expect, it } from "vitest";
import { parseWholeNumber } from "./numbers";

it("reads digits only", () => {
  expect(parseWholeNumber(" 12 ")).toBe(12);
  expect(parseWholeNumber("0")).toBe(0);
  for (const text of ["", "1e3", "0x10", "1.5", "-1", "1 2", "99999999999999999999"]) {
    expect(parseWholeNumber(text)).toBeUndefined();
  }
});
