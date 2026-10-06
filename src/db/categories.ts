import type { CategoryRules } from "@/engine";
import { categoryName, subgroupName } from "@/lib/labels";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/** A competition's category: one level of one library sub-group, copied in. */
export interface Category extends CategoryRules {
  id: number;
  name: string;
  /** e.g. "Junior"; empty for categories created before the category hierarchy. */
  ageGroup: string;
  /** e.g. "Gold"; empty for a sub-group without levels, and for categories created before the hierarchy. */
  level: string;
  /**
   * The station sets it is scored on (Fitness Challenge), in set order: each is ranked on its own,
   * plus an overall ranking when there are several. Empty = none picked yet / Speed Fit.
   */
  stationSetIds: number[];
}

/** A library sub-group within a competition (e.g. "Junior Men 14–23") and the indexes of its levels. */
export interface SubgroupCategories {
  key: string;
  label: string;
  categoryIndexes: number[];
}

/**
 * Groups categories by sub-group, in order of first appearance; levels keep their order.
 * Categories created before the hierarchy (no age group) form a group of their own.
 */
export function groupBySubgroup(categories: readonly Category[]): SubgroupCategories[] {
  const groups = new Map<string, SubgroupCategories>();
  categories.forEach((category, index) => {
    const key = category.ageGroup
      ? JSON.stringify([category.ageGroup, category.gender, category.minAge, category.maxAge])
      : `name:${category.name}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: category.ageGroup ? subgroupName(category.ageGroup, category) : category.name, categoryIndexes: [] };
      groups.set(key, group);
    }
    group.categoryIndexes.push(index);
  });
  return [...groups.values()];
}

/**
 * A competition's categories, each sub-group's levels together (in the order they were added).
 * Library categories are named from their parts on every read, so naming fixes apply to
 * categories saved earlier too.
 */
export async function listCategories(competitionId: number): Promise<Category[]> {
  const raw = await (await db()).select<(Omit<Category, "stationSetIds"> & { stationSetIds: string })[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge, age_group AS ageGroup, level,
            (SELECT json_group_array(set_id) FROM (SELECT set_id FROM category_station_sets WHERE category_id = c.id ORDER BY set_id)) AS stationSetIds
     FROM categories c WHERE competition_id = $1
     ORDER BY id`,
    [competitionId],
  );
  const rows: Category[] = raw.map((row) => ({ ...row, stationSetIds: JSON.parse(row.stationSetIds) as number[] }));
  const named = rows.map((row) => (row.ageGroup ? { ...row, name: categoryName(row.ageGroup, row, row.level) } : row));
  return groupBySubgroup(named).flatMap((group) => group.categoryIndexes.map((i) => named[i]!));
}

type LibraryLevel = CategoryRules & { ageGroup: string; level: string };

/**
 * Copies the chosen library levels, and sub-groups without levels, into a competition (a snapshot:
 * later library edits don't affect it); a trigger (0012) puts each on the competition's first station set.
 * One INSERT, so either every category is added or none is.
 */
export async function addCategoriesFromLibrary(args: { competitionId: number; levelIds: number[]; subgroupIds: number[] }): Promise<void> {
  const conn = await db();
  const levels = await conn.select<LibraryLevel[]>(
    `SELECT g.id AS groupId, s.id AS subgroupId, l.id AS levelId, g.name AS ageGroup, s.gender, s.min_age AS minAge, s.max_age AS maxAge, l.name AS level
     FROM category_levels l
     JOIN age_subgroups s ON s.id = l.subgroup_id
     JOIN age_groups g ON g.id = s.age_group_id
     WHERE l.id IN (SELECT value FROM json_each($1))
     UNION ALL
     SELECT g.id, s.id, 0, g.name, s.gender, s.min_age, s.max_age, ''
     FROM age_subgroups s
     JOIN age_groups g ON g.id = s.age_group_id
     WHERE s.id IN (SELECT value FROM json_each($2))
     ORDER BY 1, 2, 3`,
    [JSON.stringify(args.levelIds), JSON.stringify(args.subgroupIds)],
  );
  if (levels.length === 0) return; // all deleted from the library meanwhile

  const COLUMNS = 7;
  const rows = levels.map((_, row) => `(${Array.from({ length: COLUMNS }, (_, col) => `$${row * COLUMNS + col + 1}`).join(", ")})`);
  const values = levels.flatMap((l) => [args.competitionId, categoryName(l.ageGroup, l, l.level), l.gender, l.minAge, l.maxAge, l.ageGroup, l.level]);
  await withConstraintMessages(
    conn.execute(`INSERT INTO categories (competition_id, name, gender, min_age, max_age, age_group, level) VALUES ${rows.join(", ")}`, values),
    { unique: "This competition already has a category with one of those names. Nothing was added." },
  );
}

/**
 * Adds or removes one of the station sets a category is scored on. Reps recorded on a removed set
 * are kept, and come back if the set is added again.
 */
export async function setCategoryUsesStationSet({ categoryId, setId, used }: { categoryId: number; setId: number; used: boolean }): Promise<void> {
  const conn = await db();
  if (used) await conn.execute("INSERT OR IGNORE INTO category_station_sets (category_id, set_id) VALUES ($1, $2)", [categoryId, setId]);
  else await conn.execute("DELETE FROM category_station_sets WHERE category_id = $1 AND set_id = $2", [categoryId, setId]);
}

/**
 * Changes a competition category's sex and age rules. A category from the library is renamed to
 * match (its name includes the ages); one created before the hierarchy keeps its name.
 */
export async function updateCategoryRules({ category, rules }: { category: Category; rules: CategoryRules }): Promise<void> {
  const name = category.ageGroup ? categoryName(category.ageGroup, rules, category.level) : category.name;
  await withConstraintMessages(
    (await db()).execute("UPDATE categories SET name = $1, gender = $2, min_age = $3, max_age = $4 WHERE id = $5", [name, rules.gender, rules.minAge, rules.maxAge, category.id]),
    { unique: `This competition already has a category named "${name}".` },
  );
}

/** Also removes the category's entries and their results. */
export async function deleteCategory(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM categories WHERE id = $1", [id]);
}
