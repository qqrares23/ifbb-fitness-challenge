import { ageOn } from "./age";
import type { AthleteProfile, CategoryRules, IsoDate } from "./types";

/**
 * Why an athlete may not enter a category on the competition date. An empty list means eligible.
 * Messages are user-facing.
 */
export function eligibilityProblems(
  athlete: AthleteProfile,
  category: CategoryRules,
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
