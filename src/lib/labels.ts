import type { CompetitionKind } from "@/db/competitions";
import type { CategoryGender, CategoryRules, Sex } from "@/engine";

export const COMPETITION_KIND_LABELS: Record<CompetitionKind, string> = {
  fitness_challenge: "Fitness Challenge",
  speed_fit: "Speed Fit",
};

export const SEX_LABELS: Record<Sex, string> = { male: "Male", female: "Female" };

export const CATEGORY_GENDER_LABELS: Record<CategoryGender, string> = { ...SEX_LABELS, mixed: "Mixed" };

export function formatAgeRange({ minAge, maxAge }: Pick<CategoryRules, "minAge" | "maxAge">): string {
  if (minAge !== null && maxAge !== null) return minAge === maxAge ? `${minAge} years` : `${minAge}–${maxAge} years`;
  if (minAge !== null) return `${minAge}+ years`;
  if (maxAge !== null) return `Up to ${maxAge} years`;
  return "Any age";
}

/** e.g. "Male · 16–20 years". */
export function describeCategoryRules(rules: CategoryRules): string {
  return `${CATEGORY_GENDER_LABELS[rules.gender]} · ${formatAgeRange(rules)}`;
}

/** How a sub-group's sex reads after the age group name: "Junior Men". */
const SUBGROUP_GENDER_LABELS: Record<CategoryGender, string> = { male: "Men", female: "Women", mixed: "Mixed" };

function compactAgeRange({ minAge, maxAge }: Pick<CategoryRules, "minAge" | "maxAge">): string {
  if (minAge !== null && maxAge !== null) return minAge === maxAge ? `${minAge}` : `${minAge}–${maxAge}`;
  if (minAge !== null) return `${minAge}+`;
  if (maxAge !== null) return `up to ${maxAge}`;
  return "";
}

/** e.g. "Junior Men 14–23". */
export function subgroupName(ageGroup: string, rules: CategoryRules): string {
  return [ageGroup, SUBGROUP_GENDER_LABELS[rules.gender], compactAgeRange(rules)].filter(Boolean).join(" ");
}

/** A competition category built from the library, e.g. "Junior Men 14–23 · Gold". */
export function categoryName(ageGroup: string, rules: CategoryRules, level: string): string {
  return `${subgroupName(ageGroup, rules)} · ${level}`;
}

/**
 * For official documents: "Junior Men 14–23 Gold Level". Categories created before the
 * hierarchy have no level and keep their own name.
 */
export function categoryTitle(category: CategoryRules & { name: string; ageGroup: string; level: string }): string {
  if (!category.level) return category.name;
  const level = /\blevel\b/i.test(category.level) ? category.level : `${category.level} Level`;
  return `${subgroupName(category.ageGroup, category)} ${level}`;
}
