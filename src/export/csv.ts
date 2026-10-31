import type { CompetitionResults } from "@/features/competitions/standings";
import { resultsTables } from "./standingsTable";

// A leading = + @ makes Excel / Sheets evaluate the cell as a formula. Plain negative numbers are
// safe and never occur here anyway, so only a "-" starting anything else ("-1+1") is neutralised.
const FORMULA_START = /^(?:[=+@\t\r]|-(?!\d+(?:\.\d+)?$))/;

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}

/**
 * One sheet for the whole competition: a Category column, then the standard results columns.
 * A header row starts the sheet and is repeated (after a blank line) wherever the station
 * columns change, i.e. where a category uses another station set. Starts with a UTF-8 BOM so
 * Excel reads accented names correctly.
 */
export function resultsCsv(results: CompetitionResults): string {
  const tables = resultsTables(results, {
    stationHeader: (s) => `Station ${s.stationNumber} - ${s.exerciseName ?? ""}`,
    missing: "",
  });
  const rows: string[][] = [];
  let previousHead = "";
  for (const { category, part, head, body } of tables) {
    const headKey = JSON.stringify(head);
    if (headKey !== previousHead) {
      if (rows.length > 0) rows.push([]);
      rows.push(["Category", ...head]);
      previousHead = headKey;
    }
    const name = part ? `${category.name} · ${part}` : category.name;
    rows.push(...body.map((row) => [name, ...row]));
  }
  return "﻿" + toCsv(rows);
}
