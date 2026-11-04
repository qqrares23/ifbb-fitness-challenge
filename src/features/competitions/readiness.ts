import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { eligibilityProblems, FORMAT_SIZE, type IsoDate } from "@/engine";
import { entryFullName, fullName } from "@/lib/labels";

export interface Readiness {
  /** Must all be fixed before the competition can start. */
  blocking: string[];
  /** Worth a look, but don't prevent starting. */
  warnings: string[];
}

/**
 * Why an entry doesn't fit its category: a couple or team without its number of athletes, or an
 * athlete outside the sex and age rules (named, in a couple or team). Empty = fits.
 */
export function entryProblems(entry: Entry, category: Category, date: IsoDate): string[] {
  const size = FORMAT_SIZE[category.format];
  const problems = entry.members.length === size ? [] : [`A ${category.format} has ${size} athletes; this one has ${entry.members.length}.`];
  for (const member of entry.members) {
    const memberProblems = eligibilityProblems(member, category, date);
    problems.push(...(entry.team ? memberProblems.map((p) => `${fullName(member)}: ${p}`) : memberProblems));
  }
  return problems;
}

export function competitionReadiness({ competition, stationSets, categories, entries }: CompetitionSetup): Readiness {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // Only Fitness Challenge categories use stations; Speed Fit has one time per athlete for the whole set of exercises.
  const fitnessChallenge = categories.filter((c) => c.kind === "fitness_challenge");
  if (fitnessChallenge.length > 0) {
    if (stationSets.length === 0) blocking.push("Add a station set.");
    for (const set of stationSets) {
      // A competition with one set reads as before: "stations 1, 2", not "Set A stations 1, 2".
      const where = stationSets.length > 1 ? `${set.name} ` : "";
      if (set.stations.length === 0) blocking.push(`Set the number of stations${where ? ` in ${set.name}` : ""}.`);
      const withoutExercise = set.stations.filter((s) => s.exerciseId === null).map((s) => s.stationNumber);
      if (withoutExercise.length > 0) {
        blocking.push(`Pick an exercise for ${where}station${withoutExercise.length > 1 ? "s" : ""} ${withoutExercise.join(", ")}.`);
      }

      const stationsByExercise = new Map<string, number[]>();
      for (const s of set.stations) {
        if (s.exerciseName === null) continue;
        stationsByExercise.set(s.exerciseName, [...(stationsByExercise.get(s.exerciseName) ?? []), s.stationNumber]);
      }
      for (const [name, numbers] of stationsByExercise) {
        if (numbers.length > 1) warnings.push(`"${name}" is used at ${where}stations ${numbers.join(", ")}.`);
      }
      if (stationSets.length > 1 && !fitnessChallenge.some((c) => c.stationSetIds.includes(set.id))) warnings.push(`No category uses ${set.name}.`);
    }
    for (const category of fitnessChallenge) {
      if (category.stationSetIds.length === 0) blocking.push(`Pick a station set for "${category.name}".`);
    }
  }

  if (entries.length === 0) blocking.push("Enter at least one athlete.");

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  for (const entry of entries) {
    const category = categoryById.get(entry.categoryId);
    if (!category) continue;
    if (entryProblems(entry, category, competition.date).length > 0) {
      blocking.push(`#${entry.bibNumber} ${entryFullName(entry)} doesn't meet the rules of "${category.name}".`);
    }
  }

  for (const category of categories) {
    if (!entries.some((e) => e.categoryId === category.id)) warnings.push(`"${category.name}" has no athletes.`);
  }

  return { blocking, warnings };
}
