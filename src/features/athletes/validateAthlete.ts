import type { IsoDate } from "@/engine";
import type { AthleteInput } from "@/db/athletes";

export type AthleteFormErrors = Partial<Record<keyof AthleteInput, string>>;

const EARLIEST_BIRTH_DATE = "1900-01-01";

export function validateAthlete(input: AthleteInput, today: IsoDate): AthleteFormErrors {
  const errors: AthleteFormErrors = {};
  if (!input.firstName.trim()) errors.firstName = "Name is required.";
  if (!input.lastName.trim()) errors.lastName = "Surname is required.";
  // ISO dates compare correctly as strings.
  if (!input.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  else if (input.dateOfBirth > today) errors.dateOfBirth = "Date of birth can't be in the future.";
  else if (input.dateOfBirth < EARLIEST_BIRTH_DATE) errors.dateOfBirth = "Check the year of birth.";
  if (!input.country) errors.country = "Country is required.";
  return errors;
}
