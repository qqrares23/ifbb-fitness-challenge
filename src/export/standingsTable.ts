import type { Category } from "@/db/categories";
import type { Entry } from "@/db/entries";
import type { Station } from "@/db/stations";
import { formatDuration } from "@/engine";
import { fullName } from "@/lib/labels";
import type { CompetitionResults } from "@/features/competitions/standings";

export interface TableFormat {
  stationHeader: (station: Station) => string;
  /** What to print where there is no result (a station, a time, or a place). */
  missing: string;
}

/** Each category's header (its station set decides the station columns) and rows in ranking order. */
export interface CategoryTable {
  category: Category;
  head: string[];
  body: string[][];
}

/** Nr Crt | Athlete Name | Country, plus Club when anyone in the category has one. */
function athleteColumns(entries: readonly Entry[]) {
  const withClub = entries.some((e) => e.club);
  return {
    head: ["Nr Crt", "Athlete Name", "Country", ...(withClub ? ["Club"] : [])],
    cells: (entry: Entry, index: number) => [String(index + 1), fullName(entry), entry.country, ...(withClub ? [entry.club] : [])],
  };
}

const orMissing = (value: string | null, format: TableFormat) => value ?? format.missing;

/**
 * The results tables every export uses, one per category, rows in ranking order:
 *   Fitness Challenge: Nr Crt | Athlete Name | Country | [Club] | <reps per station of its set…> | Total | Placement
 *   Speed Fit:         Nr Crt | Athlete Name | Country | [Club] | Time | Placement
 */
export function resultsTables(results: CompetitionResults, format: TableFormat): CategoryTable[] {
  if (results.kind === "speed_fit") {
    return results.categories.map(({ category, rows }) => {
      const athlete = athleteColumns(rows.map((r) => r.entry));
      return {
        category,
        head: [...athlete.head, "Time", "Placement"],
        body: rows.map((row, index) => [
          ...athlete.cells(row.entry, index),
          orMissing(row.timeMs === null ? null : formatDuration(row.timeMs), format),
          orMissing(row.place === null ? null : String(row.place), format),
        ]),
      };
    });
  }
  return results.categories.map(({ category, stationSet, rows }) => {
    const stations = stationSet?.stations ?? [];
    const athlete = athleteColumns(rows.map((r) => r.entry));
    return {
      category,
      head: [...athlete.head, ...stations.map(format.stationHeader), "Total", "Placement"],
      body: rows.map((row, index) => [
        ...athlete.cells(row.entry, index),
        ...stations.map((s) => orMissing(row.perStation.get(s.stationNumber)?.toString() ?? null, format)),
        String(row.totalReps),
        String(row.place),
      ]),
    };
  });
}

/** A file-name-safe version of the competition name, e.g. "World Cup 2026" → "world-cup-2026". */
export function exportFileStem(competitionName: string): string {
  const slug = competitionName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "competition"}-results`;
}
