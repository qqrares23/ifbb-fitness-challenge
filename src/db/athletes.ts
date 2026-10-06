import type { IsoDate, Sex } from "@/engine";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

export interface Athlete {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: IsoDate;
  sex: Sex;
  /** ISO 3166-1 alpha-3. */
  country: string;
  /** Optional; empty when the athlete has no club. */
  club: string;
}

export type AthleteInput = Omit<Athlete, "id">;

const COLUMNS = "id, first_name AS firstName, last_name AS lastName, date_of_birth AS dateOfBirth, sex, country, club";

function values(input: AthleteInput) {
  return [input.firstName.trim(), input.lastName.trim(), input.dateOfBirth, input.sex, input.country.toUpperCase(), input.club.trim()];
}

export async function listAthletes(): Promise<Athlete[]> {
  return (await db()).select<Athlete[]>(
    `SELECT ${COLUMNS} FROM athletes ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE`,
  );
}

export async function createAthlete(input: AthleteInput): Promise<void> {
  await (await db()).execute(
    "INSERT INTO athletes (first_name, last_name, date_of_birth, sex, country, club) VALUES ($1, $2, $3, $4, $5, $6)",
    values(input),
  );
}

export async function updateAthlete({ id, ...input }: Athlete): Promise<void> {
  await (await db()).execute(
    "UPDATE athletes SET first_name = $1, last_name = $2, date_of_birth = $3, sex = $4, country = $5, club = $6 WHERE id = $7",
    [...values(input), id],
  );
}

export async function deleteAthlete(id: number): Promise<void> {
  await withConstraintMessages((await db()).execute("DELETE FROM athletes WHERE id = $1", [id]), {
    foreignKey: "This athlete is entered in a competition and can't be deleted.",
  });
}
