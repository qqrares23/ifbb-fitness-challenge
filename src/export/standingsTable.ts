import type { Station } from "@/db/stations";
import type { CategoryStandings } from "@/features/competitions/standings";

export interface StandingsTable {
  head: string[];
  body: string[][];
}

export interface TableFormat {
  stationHeader: (station: Station) => string;
  /** What to print for a station with no recorded result. */
  missingReps: string;
}

export function standingsHead(stations: readonly Station[], format: Pick<TableFormat, "stationHeader">): string[] {
  return ["Nr Crt", "Athlete Name", "Country", ...stations.map(format.stationHeader), "Placement"];
}

/**
 * The results table shared by every export:
 * Nr Crt | Athlete Name | Country | <reps per station…> | Placement — rows in ranking order.
 */
export function buildStandingsTable(standings: CategoryStandings, stations: readonly Station[], format: TableFormat): StandingsTable {
  return {
    head: standingsHead(stations, format),
    body: standings.rows.map((row, index) => [
      String(index + 1),
      `${row.entry.firstName} ${row.entry.lastName}`,
      row.entry.country,
      ...stations.map((s) => {
        const reps = row.perStation.get(s.stationNumber);
        return reps == null ? format.missingReps : String(reps);
      }),
      String(row.place),
    ]),
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
