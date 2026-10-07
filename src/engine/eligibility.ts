import { ageOn } from "./age";
import type { AthleteProfile, CategoryFormat, CategoryRules, IsoDate } from "./types";

/** Athletes per entry. */
export const FORMAT_SIZE: Record<CategoryFormat, number> = { individual: 1, couple: 2, team: 4 };

/**
 * Why an athlete may not enter a category on the competition date. An empty list means eligible.
 * Messages are user-facing.
 */
export function eligibilityProblems(
  athlete: AthleteProfile,
  category: Omit<CategoryRules, "format">,
  competitionDate: IsoDate,
): string[] {
  const problems: string[] = [];

  if (category.gender !== "mixed" && category.gender !== athlete.sex) {
    problems.push(`Category is for ${category.gender} athletes only.`);
  }

  const age = ageOn(athlete.dateOfBirth, competitionDate);
  if (category.minAge !== null && age < category.minAge) {
    problems.push(`Athlete is ${age} on the competition date; minimum age is ${category.minAge}.`);
  }
  if (category.maxAge !== null && age > category.maxAge) {
    problems.push(`Athlete is ${age} on the competition date; maximum age is ${category.maxAge}.`);
  }

  return problems;
}
