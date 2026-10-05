import type { CompetitionSetup } from "@/db/competitions";
import type { CategoryStandings } from "@/features/competitions/standings";
import { buildStandingsTable, standingsHead, type TableFormat } from "./standingsTable";

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
export function standingsCsv(setup: CompetitionSetup, standings: readonly CategoryStandings[]): string {
  const format: TableFormat = {
    stationHeader: (s) => `Station ${s.stationNumber} - ${s.exerciseName ?? ""}`,
    missingReps: "",
  };
  const head = ["Category", ...standingsHead(setup.stations, format)];
  const body = standings.flatMap((s) => buildStandingsTable(s, setup.stations, format).body.map((row) => [s.category.name, ...row]));
  return "\uFEFF" + toCsv([head, ...body]);
}
