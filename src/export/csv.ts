import type { CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { resultsTables } from "./standingsTable";

// A leading = + @ makes Excel / Sheets evaluate the cell as a formula. Negative numbers are
// safe and never occur here anyway, so only a "-" followed by a non-digit is neutralised.
const FORMULA_START = /^(?:[=+@\t\r]|-(?!\d))/;

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}

/**
 * One flat sheet for the whole competition: a Category column, then the standard results
 * columns. Starts with a UTF-8 BOM so Excel reads accented names correctly.
 */
export function resultsCsv(setup: CompetitionSetup, results: CompetitionResults): string {
  const { head, categories } = resultsTables(setup, results, {
    stationHeader: (s) => `Station ${s.stationNumber} - ${s.exerciseName ?? ""}`,
    missing: "",
  });
  const body = categories.flatMap(({ category, body }) => body.map((row) => [category.name, ...row]));
  return "﻿" + toCsv([["Category", ...head], ...body]);
}
