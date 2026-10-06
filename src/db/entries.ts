import type { Athlete } from "./athletes";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/**
 * An athlete entered into one category of a competition, with the athlete's details joined in.
 * An athlete can have several entries (one per category), all sharing one bib number.
 */
export interface Entry extends Omit<Athlete, "id"> {
  id: number;
  athleteId: number;
  categoryId: number;
  bibNumber: number;
  /** Entered after the competition started (set by the database, see 0005). */
  lateEntry: boolean;
}

export async function listEntries(competitionId: number): Promise<Entry[]> {
  const rows = await (await db()).select<(Omit<Entry, "lateEntry"> & { lateEntry: number })[]>(
    `SELECT e.id, e.athlete_id AS athleteId, e.category_id AS categoryId, e.bib_number AS bibNumber, e.late_entry AS lateEntry,
            a.first_name AS firstName, a.last_name AS lastName, a.date_of_birth AS dateOfBirth, a.sex, a.country
     FROM entries e JOIN athletes a ON a.id = e.athlete_id
     WHERE e.competition_id = $1
     ORDER BY e.bib_number`,
    [competitionId],
  );
  // SQLite has no boolean type; the column is 0 / 1.
  return rows.map((row) => ({ ...row, lateEntry: row.lateEntry === 1 }));
}

/**
 * Enters each athlete into the category. An athlete already in another category of this
 * competition keeps their bib; new athletes get the next free bib numbers, in the order given.
 * One statement (bib allocation included), so either every athlete is entered or none is.
 */
export async function addEntries(args: { competitionId: number; categoryId: number; athleteIds: number[] }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute(
      `WITH picked AS (SELECT CAST(value AS INTEGER) AS athlete_id, key AS position FROM json_each($3)),
            existing AS (SELECT athlete_id, MIN(bib_number) AS bib FROM entries WHERE competition_id = $1 GROUP BY athlete_id),
            next_free AS (SELECT COALESCE(MAX(bib_number), 0) AS bib FROM entries WHERE competition_id = $1)
       INSERT INTO entries (competition_id, category_id, athlete_id, bib_number)
       SELECT $1, $2, p.athlete_id,
              COALESCE(e.bib, (SELECT bib FROM next_free) + ROW_NUMBER() OVER (PARTITION BY e.bib IS NULL ORDER BY p.position))
       FROM picked p LEFT JOIN existing e ON e.athlete_id = p.athlete_id
       ORDER BY p.position`,
      [args.competitionId, args.categoryId, JSON.stringify(args.athleteIds)],
    ),
    { unique: "One of those athletes is already entered in this category. Nobody was entered." },
  );
}

export async function setEntryCategory(args: { entryId: number; categoryId: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE entries SET category_id = $1 WHERE id = $2", [args.categoryId, args.entryId]),
    { unique: "That athlete is already entered in that category." },
  );
}

/** Changes the athlete's bib on every one of their entries in the competition. */
export async function setEntryBib(args: { entryId: number; bibNumber: number }): Promise<void> {
  if (!Number.isInteger(args.bibNumber) || args.bibNumber < 1) throw new Error("A bib number must be a whole number of 1 or more.");
  await (await db()).execute(
    `UPDATE entries SET bib_number = $1
     WHERE (competition_id, athlete_id) = (SELECT competition_id, athlete_id FROM entries WHERE id = $2)`,
    [args.bibNumber, args.entryId],
  );
}

export async function deleteEntry(entryId: number): Promise<void> {
  await (await db()).execute("DELETE FROM entries WHERE id = $1", [entryId]);
}
