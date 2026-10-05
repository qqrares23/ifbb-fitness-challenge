import { db } from "./client";

export interface Station {
  stationNumber: number;
  exerciseId: number | null;
  exerciseName: string | null;
}

export const MAX_STATIONS = 50;

export async function listStations(competitionId: number): Promise<Station[]> {
  return (await db()).select<Station[]>(
    `SELECT s.station_number AS stationNumber, s.exercise_id AS exerciseId, x.name AS exerciseName
     FROM competition_stations s LEFT JOIN exercises x ON x.id = s.exercise_id
     WHERE s.competition_id = $1
     ORDER BY s.station_number`,
    [competitionId],
  );
}

/** Grows or shrinks the station list to exactly `count`, keeping the exercises already picked for stations 1..count. */
export async function setStationCount({ competitionId, count }: { competitionId: number; count: number }): Promise<void> {
  if (!Number.isInteger(count) || count < 0 || count > MAX_STATIONS) {
    throw new Error(`The number of stations must be a whole number between 0 and ${MAX_STATIONS}.`);
  }
  const conn = await db();
  // Two idempotent statements: re-running after a partial failure converges on the same result.
  await conn.execute(
    `INSERT OR IGNORE INTO competition_stations (competition_id, station_number)
     WITH RECURSIVE seq(n) AS (SELECT 1 WHERE $2 >= 1 UNION ALL SELECT n + 1 FROM seq WHERE n < $2)
     SELECT $1, n FROM seq`,
    [competitionId, count],
  );
  await conn.execute("DELETE FROM competition_stations WHERE competition_id = $1 AND station_number > $2", [competitionId, count]);
}

export async function setStationExercise(args: { competitionId: number; stationNumber: number; exerciseId: number | null }) {
  await (await db()).execute(
    "UPDATE competition_stations SET exercise_id = $1 WHERE competition_id = $2 AND station_number = $3",
    [args.exerciseId, args.competitionId, args.stationNumber],
  );
}
