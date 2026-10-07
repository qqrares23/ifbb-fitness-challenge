import type { Athlete } from "./athletes";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

export type EntryMember = Omit<Athlete, "id"> & { athleteId: number };

/**
 * An athlete, couple or team entered into one category of a competition. An athlete can have
 * several individual entries (one per category), all sharing one bib number; a couple or team
 * has a number of its own. The athlete fields are those of the (first) athlete; use `members`
 * for everyone in a couple or team.
 */
export interface Entry extends Omit<Athlete, "id"> {
  id: number;
  /** The athlete, or a couple's / team's first athlete. */
  athleteId: number;
  categoryId: number;
  bibNumber: number;
  /** Entered after the competition started (set by the database, see 0005). */
  lateEntry: boolean;
  /** A couple or team (its category isn't for individuals). */
  team: boolean;
  /** The athlete alone, or the couple's / team's athletes in order. */
  members: EntryMember[];
}

const ATHLETE_COLUMNS = "a.first_name AS firstName, a.last_name AS lastName, a.date_of_birth AS dateOfBirth, a.sex, a.country, a.club";

export async function listEntries(competitionId: number): Promise<Entry[]> {
  const conn = await db();
  const [rows, teamMembers] = await Promise.all([
    conn.select<(Omit<Entry, "lateEntry" | "team" | "members"> & { lateEntry: number; team: number })[]>(
      `SELECT e.id, e.athlete_id AS athleteId, e.category_id AS categoryId, e.bib_number AS bibNumber, e.late_entry AS lateEntry,
              k.format <> 'individual' AS team, ${ATHLETE_COLUMNS}
       FROM entries e JOIN athletes a ON a.id = e.athlete_id JOIN categories k ON k.id = e.category_id
       WHERE e.competition_id = $1
       ORDER BY e.bib_number`,
      [competitionId],
    ),
    conn.select<(EntryMember & { entryId: number })[]>(
      `SELECT m.entry_id AS entryId, m.athlete_id AS athleteId, ${ATHLETE_COLUMNS}
       FROM entry_members m JOIN entries e ON e.id = m.entry_id JOIN athletes a ON a.id = m.athlete_id
       WHERE e.competition_id = $1
       ORDER BY m.entry_id, m.position`,
      [competitionId],
    ),
  ]);
  const membersByEntry = new Map<number, EntryMember[]>();
  for (const { entryId, ...member } of teamMembers) membersByEntry.set(entryId, [...(membersByEntry.get(entryId) ?? []), member]);
  // SQLite has no boolean type; those columns are 0 / 1.
  return rows.map(({ lateEntry, team, ...row }) => ({
    ...row,
    lateEntry: lateEntry === 1,
    team: team === 1,
    members: team === 1 ? (membersByEntry.get(row.id) ?? []) : [row],
  }));
}

/**
 * Enters athletes into the category. An athlete already in another category of this competition
 * keeps their number (bib). Otherwise `bibNumbers[i]` sets athlete i's number by hand, and null
 * means automatic: the next free numbers, in the order given (after any typed by hand).
 * One statement, so either every athlete is entered or none is.
 */
export async function addEntries(args: {
  competitionId: number;
  categoryId: number;
  athleteIds: number[];
  bibNumbers?: (number | null)[];
}): Promise<void> {
  const picked = args.athleteIds.map((athleteId, i) => ({ a: athleteId, n: args.bibNumbers?.[i] ?? null }));
  for (const { n } of picked) {
    if (n !== null && (!Number.isInteger(n) || n < 1)) throw new Error("A number must be a whole number of 1 or more.");
  }
  await withConstraintMessages(
    (await db()).execute(
      `WITH picked AS (
              SELECT CAST(json_extract(value, '$.a') AS INTEGER) AS athlete_id, json_extract(value, '$.n') AS bib, key AS position
              FROM json_each($3)),
            existing AS (
              SELECT e.athlete_id, MIN(e.bib_number) AS bib FROM entries e JOIN categories k ON k.id = e.category_id
              WHERE e.competition_id = $1 AND k.format = 'individual' GROUP BY e.athlete_id),
            next_free AS (
              SELECT MAX(COALESCE((SELECT MAX(bib_number) FROM entries WHERE competition_id = $1), 0),
                         COALESCE((SELECT MAX(bib) FROM picked), 0)) AS bib)
       INSERT INTO entries (competition_id, category_id, athlete_id, bib_number)
       SELECT $1, $2, p.athlete_id,
              COALESCE(e.bib, p.bib, (SELECT bib FROM next_free) + ROW_NUMBER() OVER (PARTITION BY e.bib IS NULL AND p.bib IS NULL ORDER BY p.position))
       FROM picked p LEFT JOIN existing e ON e.athlete_id = p.athlete_id
       ORDER BY p.position`,
      [args.competitionId, args.categoryId, JSON.stringify(picked)],
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

/**
 * Enters a couple or team (athletes in order) into the category with one number: `bibNumber`, or
 * the next free one when null. The entry and its members are two statements; if the members are
 * refused (e.g. one is already in another couple of that category) the entry is taken out again.
 */
export async function addTeamEntry(args: { competitionId: number; categoryId: number; size: number; athleteIds: number[]; bibNumber: number | null }): Promise<void> {
  const { competitionId, categoryId, athleteIds, bibNumber } = args;
  if (athleteIds.length !== args.size || new Set(athleteIds).size !== athleteIds.length) throw new Error(`Pick ${args.size} different athletes.`);
  if (bibNumber !== null && (!Number.isInteger(bibNumber) || bibNumber < 1)) throw new Error("A number must be a whole number of 1 or more.");
  const conn = await db();
  const { lastInsertId } = await withConstraintMessages(
    conn.execute(
      `INSERT INTO entries (competition_id, category_id, athlete_id, bib_number)
       VALUES ($1, $2, $3, COALESCE($4, (SELECT COALESCE(MAX(bib_number), 0) + 1 FROM entries WHERE competition_id = $1)))`,
      [competitionId, categoryId, athleteIds[0], bibNumber],
    ),
    { unique: "An athlete can be in only one couple or team per category." },
  );
  try {
    await conn.execute("INSERT INTO entry_members (entry_id, athlete_id, position) SELECT $1, value, key + 1 FROM json_each($2)", [
      lastInsertId,
      JSON.stringify(athleteIds),
    ]);
  } catch (error) {
    await conn.execute("DELETE FROM entries WHERE id = $1", [lastInsertId]).catch(() => undefined);
    throw error;
  }
}

/** Changes a number: on every individual entry of the athlete, or on the couple's / team's entry. */
export async function setEntryBib(args: { entryId: number; bibNumber: number }): Promise<void> {
  if (!Number.isInteger(args.bibNumber) || args.bibNumber < 1) throw new Error("A bib number must be a whole number of 1 or more.");
  await (await db()).execute(
    `WITH target AS (SELECT e.id, e.competition_id, e.athlete_id, k.format FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = $2)
     UPDATE entries SET bib_number = $1
     WHERE id = (SELECT id FROM target)
        OR ((SELECT format FROM target) = 'individual'
            AND (competition_id, athlete_id) = (SELECT competition_id, athlete_id FROM target)
            AND (SELECT format FROM categories WHERE id = entries.category_id) = 'individual')`,
    [args.bibNumber, args.entryId],
  );
}

export async function deleteEntry(entryId: number): Promise<void> {
  await (await db()).execute("DELETE FROM entries WHERE id = $1", [entryId]);
}
