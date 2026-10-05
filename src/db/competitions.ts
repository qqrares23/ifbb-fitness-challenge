import type { IsoDate } from "@/engine";
import { db } from "./client";
import { listCategories, type Category } from "./categories";
import { listEntries, type Entry } from "./entries";
import { listStations, type Station } from "./stations";

export type CompetitionStatus = "draft" | "running" | "finished";

export interface Competition {
  id: number;
  name: string;
  date: IsoDate;
  location: string;
  status: CompetitionStatus;
}

export interface CompetitionSummary extends Competition {
  stationCount: number;
  categoryCount: number;
  entryCount: number;
}

export type CompetitionInput = Pick<Competition, "name" | "date" | "location">;

/** Everything the competition screens need, read in one go. */
export interface CompetitionSetup {
  competition: Competition;
  stations: Station[];
  categories: Category[];
  entries: Entry[];
}

const COLUMNS = "id, name, date, location, status";

function values(input: CompetitionInput) {
  return [input.name.trim(), input.date, input.location.trim()];
}

export async function listCompetitions(): Promise<CompetitionSummary[]> {
  return (await db()).select<CompetitionSummary[]>(
    `SELECT ${COLUMNS},
       (SELECT COUNT(*) FROM competition_stations s WHERE s.competition_id = c.id) AS stationCount,
       (SELECT COUNT(*) FROM categories k WHERE k.competition_id = c.id) AS categoryCount,
       (SELECT COUNT(*) FROM entries e WHERE e.competition_id = c.id) AS entryCount
     FROM competitions c
     ORDER BY date DESC, id DESC`,
  );
}

export async function getCompetitionSetup(id: number): Promise<CompetitionSetup | null> {
  const [rows, stations, categories, entries] = await Promise.all([
    (await db()).select<Competition[]>(`SELECT ${COLUMNS} FROM competitions WHERE id = $1`, [id]),
    listStations(id),
    listCategories(id),
    listEntries(id),
  ]);
  const competition = rows[0];
  return competition ? { competition, stations, categories, entries } : null;
}

/** Returns the new competition's id. */
export async function createCompetition(input: CompetitionInput): Promise<number> {
  const result = await (await db()).execute(
    "INSERT INTO competitions (name, date, location) VALUES ($1, $2, $3)",
    values(input),
  );
  return result.lastInsertId!;
}

export async function updateCompetition({ id, ...input }: CompetitionInput & { id: number }): Promise<void> {
  await (await db()).execute("UPDATE competitions SET name = $1, date = $2, location = $3 WHERE id = $4", [...values(input), id]);
}

export async function deleteCompetition(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM competitions WHERE id = $1", [id]);
}

/** Moves a competition to its next state; the allowed transitions are enforced by the database. */
export async function setCompetitionStatus(id: number, status: CompetitionStatus): Promise<void> {
  const stamp = status === "running" ? ", started_at = COALESCE(started_at, datetime('now'))" : status === "finished" ? ", finished_at = datetime('now')" : "";
  await (await db()).execute(`UPDATE competitions SET status = $1${stamp} WHERE id = $2`, [status, id]);
}
