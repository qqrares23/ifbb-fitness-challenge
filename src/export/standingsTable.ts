import type { Category } from "@/db/categories";
import type { Entry } from "@/db/entries";
import type { Station } from "@/db/stations";
import { formatDuration } from "@/engine";
import { entryClubs, entryCountries, entryFullName } from "@/lib/labels";
import type { CompetitionResults } from "@/features/competitions/standings";

export interface TableFormat {
  stationHeader: (station: Station) => string;
  /** What to print where there is no result (a station, a time, or a place). */
  missing: string;
}

/** Each category's header (its station set decides the station columns) and rows in ranking order. */
export interface CategoryTable {
  category: Category;
  /** Which ranking of the category: a station set's name, "Overall", or null when it has just one. */
  part: string | null;
  head: string[];
  body: string[][];
}

const NAME_HEADERS = { individual: "Athlete Name", couple: "Couple", team: "Team" } as const;

/**
 * Nr Crt | Athlete Name (or Couple / Team) | Country, plus Club when anyone in the category has
 * one, except in IFBB Fitness Challenge categories, which only show the country.
 */
function athleteColumns(results: CompetitionResults, category: Category, entries: readonly Entry[]) {
  const ifbbFitnessChallenge = results.kind === "fitness_challenge" && category.federation === "ifbb";
  const withClub = !ifbbFitnessChallenge && entries.some((e) => entryClubs(e));
  return {
    head: ["Nr Crt", NAME_HEADERS[category.format], "Country", ...(withClub ? ["Club"] : [])],
    cells: (entry: Entry, index: number) => [String(index + 1), entryFullName(entry), entryCountries(entry), ...(withClub ? [entryClubs(entry)] : [])],
  };
}

const orMissing = (value: string | null, format: TableFormat) => value ?? format.missing;

/**
 * The results tables every export uses, one per category, rows in ranking order:
 * (Athlete Name reads Couple / Team in those categories.)
 *   Fitness Challenge: Nr Crt | Athlete Name | Country | [Club] | <reps per station of its set…> | Total | Placement
 *     (one per station set; with several sets also "Overall": <total per set…> | Total | Placement)
 *   Speed Fit:         Nr Crt | Athlete Name | Country | [Club] | Time | Placement
 */
export function resultsTables(results: CompetitionResults, format: TableFormat): CategoryTable[] {
  if (results.kind === "speed_fit") {
    return results.categories.map(({ category, rows }) => {
      const athlete = athleteColumns(results, category, rows.map((r) => r.entry));
      return {
        category,
        part: null,
        head: [...athlete.head, "Time", "Placement"],
        body: rows.map((row, index) => [
          ...athlete.cells(row.entry, index),
          orMissing(row.timeMs === null ? null : formatDuration(row.timeMs), format),
          orMissing(row.place === null ? null : String(row.place), format),
        ]),
      };
    });
  }
  // Fitness Challenge: a table per station set, plus an overall one when the category uses several.
  return results.categories.flatMap(({ category, sets, overall, rows }) => {
    const athlete = athleteColumns(results, category, rows.map((r) => r.entry));
    const table = (part: string | null, columns: { header: string; key: number }[], ranked: typeof rows): CategoryTable => ({
      category,
      part,
      head: [...athlete.head, ...columns.map((c) => c.header), "Total", "Placement"],
      body: ranked.map((row, index) => [
        ...athlete.cells(row.entry, index),
        ...columns.map((c) => orMissing(row.perStation.get(c.key)?.toString() ?? null, format)),
        String(row.totalReps),
        String(row.place),
      ]),
    });
    if (sets.length === 0) return [table(null, [], rows)];
    const perSet = sets.map(({ stationSet, rows: ranked }) =>
      table(sets.length > 1 ? stationSet.name : null, stationSet.stations.map((s) => ({ header: format.stationHeader(s), key: s.stationNumber })), ranked),
    );
    return overall ? [...perSet, table("Overall", sets.map((s, i) => ({ header: s.stationSet.name, key: i })), overall)] : perSet;
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
