import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import type { Station } from "@/db/stations";
import { formatDuration } from "@/engine";
import type { CompetitionResults } from "@/features/competitions/standings";

export interface TableFormat {
  stationHeader: (station: Station) => string;
  /** What to print where there is no result (a station, a time, or a place). */
  missing: string;
}

/** One header for the whole competition, and the rows of each category in ranking order. */
export interface ResultsTables {
  head: string[];
  categories: { category: Category; body: string[][] }[];
}

const ATHLETE_HEAD = ["Nr Crt", "Athlete Name", "Country"];

function athleteCells(entry: Entry, index: number): string[] {
  return [String(index + 1), `${entry.firstName} ${entry.lastName}`, entry.country];
}

const orMissing = (value: string | null, format: TableFormat) => value ?? format.missing;

/**
 * The results table every export uses:
 *   Fitness Challenge: Nr Crt | Athlete Name | Country | <reps per station…> | Placement
 *   Speed Fit:         Nr Crt | Athlete Name | Country | Time | Placement
 */
export function resultsTables(setup: CompetitionSetup, results: CompetitionResults, format: TableFormat): ResultsTables {
  if (results.kind === "speed_fit") {
    return {
      head: [...ATHLETE_HEAD, "Time", "Placement"],
      categories: results.categories.map(({ category, rows }) => ({
        category,
        body: rows.map((row, index) => [
          ...athleteCells(row.entry, index),
          orMissing(row.timeMs === null ? null : formatDuration(row.timeMs), format),
          orMissing(row.place === null ? null : String(row.place), format),
        ]),
      })),
    };
  }
  return {
    head: [...ATHLETE_HEAD, ...setup.stations.map(format.stationHeader), "Placement"],
    categories: results.categories.map(({ category, rows }) => ({
      category,
      body: rows.map((row, index) => [
        ...athleteCells(row.entry, index),
        ...setup.stations.map((s) => orMissing(row.perStation.get(s.stationNumber)?.toString() ?? null, format)),
        String(row.place),
      ]),
    })),
  };
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
