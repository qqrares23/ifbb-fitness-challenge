import type { CompetitionKind } from "@/db/competitions";
import type { CategoryGender, CategoryRules, Sex } from "@/engine";

export const COMPETITION_KIND_LABELS: Record<CompetitionKind, string> = {
  fitness_challenge: "Fitness Challenge",
  speed_fit: "Speed Fit",
};

export const SEX_LABELS: Record<Sex, string> = { male: "Male", female: "Female" };

export const CATEGORY_GENDER_LABELS: Record<CategoryGender, string> = { ...SEX_LABELS, mixed: "Mixed" };

type Named = { firstName: string; lastName: string };

/** "Ana Pop": for sentences, toasts, the winner banner and official results. */
export const fullName = (a: Named) => `${a.firstName.trim()} ${a.lastName.trim()}`;

/** "Pop Ana": for tables and pick lists, which are sorted by surname. */
export const listName = (a: Named) => `${a.lastName.trim()} ${a.firstName.trim()}`;

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

/** Words that already state a sub-group's sex inside an age group name. */
const SEX_WORDS: Record<CategoryGender, RegExp> = {
  male: /\b(men|male|man)\b/i,
  female: /\b(women|female|woman)\b/i,
  mixed: /\bmixed\b/i,
};

/**
 * e.g. "Junior Men 14–23". Whatever the age group name already says isn't repeated: libraries
 * upgraded from flat categories have age groups like "Juniors Men 16–20" (see migration 0006).
 */
export function subgroupName(ageGroup: string, rules: CategoryRules): string {
  const range = compactAgeRange(rules);
  // Whole-word match; any dash counts as the range dash, so "16-20" matches "16–20".
  const padded = ` ${ageGroup.replace(/\s*[-‐-―]\s*/g, "–").toLowerCase().split(/\s+/).join(" ")} `;
  return [
    ageGroup.trim(),
    SEX_WORDS[rules.gender].test(ageGroup) ? "" : SUBGROUP_GENDER_LABELS[rules.gender],
    padded.includes(` ${range.toLowerCase()} `) ? "" : range,
  ]
    .filter(Boolean)
    .join(" ");
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
