import { db } from "./client";
import { withConstraintMessages } from "./errors";

export interface Station {
  stationNumber: number;
  exerciseId: number | null;
  exerciseName: string | null;
}

/** A Fitness Challenge competition's set of stations (Set A, Set B…); each category uses one. */
export interface StationSet {
  id: number;
  name: string;
  stations: Station[];
}

export const MAX_STATIONS = 50;

export async function listStationSets(competitionId: number): Promise<StationSet[]> {
  const conn = await db();
  const [sets, stations] = await Promise.all([
    conn.select<Omit<StationSet, "stations">[]>("SELECT id, name FROM station_sets WHERE competition_id = $1 ORDER BY id", [competitionId]),
    conn.select<(Station & { setId: number })[]>(
      `SELECT s.set_id AS setId, s.station_number AS stationNumber, s.exercise_id AS exerciseId, x.name AS exerciseName
       FROM competition_stations s
       JOIN station_sets t ON t.id = s.set_id
       LEFT JOIN exercises x ON x.id = s.exercise_id
       WHERE t.competition_id = $1
       ORDER BY s.station_number`,
      [competitionId],
    ),
  ]);
  return sets.map((set) => ({ ...set, stations: stations.filter((s) => s.setId === set.id).map(({ setId: _, ...station }) => station) }));
}

/** "Set A", "Set B"… (then "Set 27"…): the first name not used yet. */
export function nextSetName(existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  for (let i = 1; ; i++) {
    const name = `Set ${i <= 26 ? String.fromCharCode(64 + i) : i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/**
 * Adds a station set. A competition's first set is also given to every category that has none,
 * so a single-set competition never needs categories assigned by hand.
 */
export async function createStationSet({ competitionId }: { competitionId: number }): Promise<void> {
  const conn = await db();
  const names = await conn.select<{ name: string }[]>("SELECT name FROM station_sets WHERE competition_id = $1", [competitionId]);
  const result = await conn.execute("INSERT INTO station_sets (competition_id, name) VALUES ($1, $2)", [competitionId, nextSetName(names.map((n) => n.name))]);
  // Later sets start unused: categories left without a set (e.g. after deleting one) are pointed
  // at the right set by hand, and readiness flags them until then.
  if (names.length === 0) {
    await conn.execute(
      `INSERT INTO category_station_sets (category_id, set_id)
       SELECT id, $1 FROM categories c WHERE competition_id = $2 AND NOT EXISTS (SELECT 1 FROM category_station_sets WHERE category_id = c.id)`,
      [result.lastInsertId, competitionId],
    );
  }
}

export async function renameStationSet({ id, name }: { id: number; name: string }): Promise<void> {
  await withConstraintMessages((await db()).execute("UPDATE station_sets SET name = $1 WHERE id = $2", [name.trim(), id]), {
    unique: `This competition already has a set named "${name.trim()}".`,
  });
}

/** Also deletes its stations and the reps recorded on them; categories stop using it. */
export async function deleteStationSet(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM station_sets WHERE id = $1", [id]);
}

/**
 * Grows or shrinks a set to exactly `count` stations, keeping the exercises (and reps) of
 * stations 1..count. Removed stations take their reps with them.
 */
export async function setStationCount({ setId, count }: { setId: number; count: number }): Promise<void> {
  if (!Number.isInteger(count) || count < 0 || count > MAX_STATIONS) {
    throw new Error(`The number of stations must be a whole number between 0 and ${MAX_STATIONS}.`);
  }
  const conn = await db();
  // Two idempotent statements: re-running after a partial failure converges on the same result.
  await conn.execute(
    `INSERT OR IGNORE INTO competition_stations (set_id, station_number)
     WITH RECURSIVE seq(n) AS (SELECT 1 WHERE $2 >= 1 UNION ALL SELECT n + 1 FROM seq WHERE n < $2)
     SELECT $1, n FROM seq`,
    [setId, count],
  );
  await conn.execute("DELETE FROM competition_stations WHERE set_id = $1 AND station_number > $2", [setId, count]);
}

/** Changing a station's exercise keeps the reps already recorded there. */
export async function setStationExercise(args: { setId: number; stationNumber: number; exerciseId: number | null }) {
  await (await db()).execute("UPDATE competition_stations SET exercise_id = $1 WHERE set_id = $2 AND station_number = $3", [
    args.exerciseId,
    args.setId,
    args.stationNumber,
  ]);
}
