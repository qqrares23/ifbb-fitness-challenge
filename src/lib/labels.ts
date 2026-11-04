import type { Federation } from "@/db/categoryLibrary";
import type { CompetitionKind } from "@/db/competitions";
import type { CategoryFormat, CategoryGender, CategoryRules, Sex } from "@/engine";

export const COMPETITION_KIND_LABELS: Record<CompetitionKind, string> = {
  fitness_challenge: "Fitness Challenge",
  speed_fit: "Speed Fit",
};

export const FEDERATION_LABELS: Record<Federation, string> = { ifbb: "IFBB", romania: "Romania" };

export const SEX_LABELS: Record<Sex, string> = { male: "Male", female: "Female" };

export const CATEGORY_GENDER_LABELS: Record<CategoryGender, string> = { ...SEX_LABELS, mixed: "Mixed" };

export const CATEGORY_FORMAT_LABELS: Record<CategoryFormat, string> = { individual: "Individual", couple: "Couple (2)", team: "Team (4)" };

type Named = { firstName: string; lastName: string };

/** "Ana Pop": for sentences, toasts, the winner banner and official results. */
export const fullName = (a: Named) => `${a.firstName.trim()} ${a.lastName.trim()}`;

/** "Pop Ana": for tables and pick lists, which are sorted by surname. */
export const listName = (a: Named) => `${a.lastName.trim()} ${a.firstName.trim()}`;

type Members = { members: readonly (Named & { country: string; club: string })[] };

/** An entry's athlete, or a couple's / team's athletes: "Ana Pop / Ion Pop". */
export const entryFullName = (e: Members) => e.members.map(fullName).join(" / ");

/** "Pop Ana / Pop Ion". */
export const entryListName = (e: Members) => e.members.map(listName).join(" / ");

/** Each value once, empty ones left out: "ROU / HUN". */
export const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].join(" / ");

/** Each country once: "ROU / HUN". */
export const entryCountries = (e: Members) => distinct(e.members.map((m) => m.country));

/** Each club once; empty when nobody has one. */
export const entryClubs = (e: Members) => distinct(e.members.map((m) => m.club.trim()));

export function formatAgeRange({ minAge, maxAge }: Pick<CategoryRules, "minAge" | "maxAge">): string {
  if (minAge !== null && maxAge !== null) return minAge === maxAge ? `${minAge} years` : `${minAge}–${maxAge} years`;
  if (minAge !== null) return `${minAge}+ years`;
  if (maxAge !== null) return `Up to ${maxAge} years`;
  return "Any age";
}

/** e.g. "Male · 16–20 years", "Couple (2) · Mixed · Any age". */
export function describeCategoryRules(rules: CategoryRules): string {
  const sexAndAge = `${CATEGORY_GENDER_LABELS[rules.gender]} · ${formatAgeRange(rules)}`;
  return rules.format === "individual" ? sexAndAge : `${CATEGORY_FORMAT_LABELS[rules.format]} · ${sexAndAge}`;
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

/** How a couple / team sub-group reads after its sex: "Senior Mixed Couple". */
const SUBGROUP_FORMAT_LABELS: Record<CategoryFormat, string> = { individual: "", couple: "Couple", team: "Team" };

/** Words that already state a sub-group's type inside an age group name (individual never shows). */
const FORMAT_WORDS: Record<CategoryFormat, RegExp> = { individual: /(?!)/, couple: /\b(couples?|pairs?)\b/i, team: /\bteams?\b/i };

/** Whether `text` already contains `phrase` as whole words; any dash counts as the range dash ("16-20" = "16–20"). */
function mentions(text: string, phrase: string): boolean {
  const words = (value: string) => ` ${value.replace(/\s*[-‐-―]\s*/g, "–").toLowerCase().split(/\s+/).filter(Boolean).join(" ")} `;
  return phrase.trim() !== "" && words(text).includes(words(phrase));
}

/**
 * e.g. "Junior Men 14–23", "Senior Mixed Couple 18+". Whatever the age group name already says
 * isn't repeated: libraries upgraded from flat categories have age groups like "Juniors Men 16–20"
 * (see migration 0006).
 */
export function subgroupName(ageGroup: string, rules: CategoryRules): string {
  const range = compactAgeRange(rules);
  return [
    ageGroup.trim(),
    SEX_WORDS[rules.gender].test(ageGroup) ? "" : SUBGROUP_GENDER_LABELS[rules.gender],
    FORMAT_WORDS[rules.format].test(ageGroup) ? "" : SUBGROUP_FORMAT_LABELS[rules.format],
    mentions(ageGroup, range) ? "" : range,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * A competition category built from the library, e.g. "Junior Men 14–23 · Gold". A sub-group
 * without levels is named after the sub-group alone, and a level the age group name already
 * states isn't repeated.
 */
export function categoryName(ageGroup: string, rules: CategoryRules, level: string, kind: CompetitionKind): string {
  const subgroup = subgroupName(ageGroup, rules);
  return withKind(kind, !level || mentions(ageGroup, level) ? subgroup : `${subgroup} · ${level}`);
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Speed Fit is named in front unless the text already says it, however it is spelled. */
function withKind(kind: CompetitionKind, text: string): string {
  const label = COMPETITION_KIND_LABELS[kind];
  return kind === "fitness_challenge" || squash(text).includes(squash(label)) ? text : `${label} · ${text}`;
}

/**
 * For official documents: "Junior Men 14–23 Gold Level". Same parts as `categoryName`, never
 * repeated; categories created before the hierarchy keep their own name.
 */
export function categoryTitle(category: CategoryRules & { name: string; ageGroup: string; level: string }): string {
  if (!category.ageGroup) return category.name;
  const subgroup = subgroupName(category.ageGroup, category);
  if (!category.level || mentions(category.ageGroup, category.level)) return subgroup;
  return `${subgroup} ${/\blevel\b/i.test(category.level) ? category.level : `${category.level} Level`}`;
}

/**
 * A section's subtitle: "Fitness Challenge — Junior Men 14–23 Gold Level" plus `suffix`. The challenge
 * isn't named again when the category already names it (Speed Fit categories have the level "Speed Fit").
 */
export function categorySubtitle(category: CategoryRules & { name: string; ageGroup: string; level: string; kind: CompetitionKind }, suffix = ""): string {
  const title = categoryTitle(category);
  const kind = COMPETITION_KIND_LABELS[category.kind];
  return `${squash(title).includes(squash(kind)) ? title : `${kind} — ${title}`}${suffix}`;
}

/** "Speed Fit — Athletes" when every category is one challenge; just "Athletes" when they mix. */
export function competitionTitle(categories: readonly { kind: CompetitionKind }[], title: string): string {
  const kinds = new Set(categories.map((c) => c.kind));
  const [only] = kinds;
  return kinds.size === 1 && only ? `${COMPETITION_KIND_LABELS[only]} — ${title}` : title;
}
