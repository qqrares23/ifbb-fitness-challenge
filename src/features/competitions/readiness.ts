import type { CompetitionSetup } from "@/db/competitions";
import { eligibilityProblems } from "@/engine";
import { fullName } from "@/lib/labels";

export interface Readiness {
  /** Must all be fixed before the competition can start. */
  blocking: string[];
  /** Worth a look, but don't prevent starting. */
  warnings: string[];
}

export function competitionReadiness({ competition, stations, categories, entries }: CompetitionSetup): Readiness {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // Speed Fit has no stations: one time per athlete for the whole set.
  if (competition.kind === "fitness_challenge" && stations.length === 0) blocking.push("Set the number of stations.");
  const withoutExercise = stations.filter((s) => s.exerciseId === null).map((s) => s.stationNumber);
  if (withoutExercise.length > 0) {
    blocking.push(`Pick an exercise for station${withoutExercise.length > 1 ? "s" : ""} ${withoutExercise.join(", ")}.`);
  }

  const stationsByExercise = new Map<string, number[]>();
  for (const s of stations) {
    if (s.exerciseName === null) continue;
    stationsByExercise.set(s.exerciseName, [...(stationsByExercise.get(s.exerciseName) ?? []), s.stationNumber]);
  }
  for (const [name, numbers] of stationsByExercise) {
    if (numbers.length > 1) warnings.push(`"${name}" is used at stations ${numbers.join(", ")}.`);
  }

  if (entries.length === 0) blocking.push("Enter at least one athlete.");

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  for (const entry of entries) {
    const category = categoryById.get(entry.categoryId);
    if (!category) continue;
    if (eligibilityProblems(entry, category, competition.date).length > 0) {
      blocking.push(`#${entry.bibNumber} ${fullName(entry)} doesn't meet the rules of "${category.name}".`);
    }
  }

  for (const category of categories) {
    if (!entries.some((e) => e.categoryId === category.id)) warnings.push(`"${category.name}" has no athletes.`);
  }

  return { blocking, warnings };
}
