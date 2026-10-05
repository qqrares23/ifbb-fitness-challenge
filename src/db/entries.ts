import type { Athlete } from "./athletes";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/** An athlete entered into a competition, with the athlete's details joined in. */
export interface Entry extends Omit<Athlete, "id"> {
  id: number;
  athleteId: number;
  categoryId: number;
  bibNumber: number;
}

export async function listEntries(competitionId: number): Promise<Entry[]> {
  return (await db()).select<Entry[]>(
    `SELECT e.id, e.athlete_id AS athleteId, e.category_id AS categoryId, e.bib_number AS bibNumber,
            a.first_name AS firstName, a.last_name AS lastName, a.date_of_birth AS dateOfBirth, a.sex, a.country
     FROM entries e JOIN athletes a ON a.id = e.athlete_id
     WHERE e.competition_id = $1
     ORDER BY e.bib_number`,
    [competitionId],
  );
}

/** Enters each athlete with the next free bib number of the competition. */
export async function addEntries(args: { competitionId: number; categoryId: number; athleteIds: number[] }): Promise<void> {
  const conn = await db();
  for (const athleteId of args.athleteIds) {
    // Bib allocation and insert in one statement, so it is atomic.
    await withConstraintMessages(
      conn.execute(
        `INSERT INTO entries (competition_id, category_id, athlete_id, bib_number)
         SELECT $1, $2, $3, COALESCE(MAX(bib_number), 0) + 1 FROM entries WHERE competition_id = $1`,
        [args.competitionId, args.categoryId, athleteId],
      ),
      { unique: "That athlete is already entered in this competition." },
    );
  }
}

export async function setEntryCategory(args: { entryId: number; categoryId: number }): Promise<void> {
  await (await db()).execute("UPDATE entries SET category_id = $1 WHERE id = $2", [args.categoryId, args.entryId]);
}

export async function setEntryBib(args: { entryId: number; bibNumber: number }): Promise<void> {
  if (!Number.isInteger(args.bibNumber) || args.bibNumber < 1) throw new Error("A bib number must be a whole number of 1 or more.");
  await withConstraintMessages(
    (await db()).execute("UPDATE entries SET bib_number = $1 WHERE id = $2", [args.bibNumber, args.entryId]),
    { unique: `Bib ${args.bibNumber} is already taken in this competition.` },
  );
}

export async function deleteEntry(entryId: number): Promise<void> {
  await (await db()).execute("DELETE FROM entries WHERE id = $1", [entryId]);
}
