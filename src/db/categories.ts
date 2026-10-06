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
  /** e.g. "Gold"; empty for categories created before the category hierarchy. */
  level: string;
}

/** A library sub-group within a competition (e.g. "Junior Men 14–23") and the indexes of its levels. */
export interface SubgroupCategories {
  key: string;
  label: string;
  categoryIndexes: number[];
}

/**
 * Groups categories by sub-group, in order of first appearance; levels keep their order.
 * Categories created before the hierarchy have no level and form a group of their own.
 */
export function groupBySubgroup(categories: readonly Category[]): SubgroupCategories[] {
  const groups = new Map<string, SubgroupCategories>();
  categories.forEach((category, index) => {
    const key = category.level
      ? JSON.stringify([category.ageGroup, category.gender, category.minAge, category.maxAge])
      : `name:${category.name}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: category.level ? subgroupName(category.ageGroup, category) : category.name, categoryIndexes: [] };
      groups.set(key, group);
    }
    group.categoryIndexes.push(index);
  });
  return [...groups.values()];
}

/** A competition's categories, each sub-group's levels together (in the order they were added). */
export async function listCategories(competitionId: number): Promise<Category[]> {
  const rows = await (await db()).select<Category[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge, age_group AS ageGroup, level
     FROM categories WHERE competition_id = $1
     ORDER BY id`,
    [competitionId],
  );
  return groupBySubgroup(rows).flatMap((group) => group.categoryIndexes.map((i) => rows[i]!));
}

type LibraryLevel = CategoryRules & { ageGroup: string; level: string };

/**
 * Copies the chosen library levels into a competition (a snapshot: later library edits don't
 * affect it). One INSERT, so either every category is added or none is.
 */
export async function addCategoriesFromLibrary(args: { competitionId: number; levelIds: number[] }): Promise<void> {
  const conn = await db();
  const levels = await conn.select<LibraryLevel[]>(
    `SELECT g.name AS ageGroup, s.gender, s.min_age AS minAge, s.max_age AS maxAge, l.name AS level
     FROM category_levels l
     JOIN age_subgroups s ON s.id = l.subgroup_id
     JOIN age_groups g ON g.id = s.age_group_id
     WHERE l.id IN (SELECT value FROM json_each($1))
     ORDER BY g.id, s.id, l.id`,
    [JSON.stringify(args.levelIds)],
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

/** Also removes the category's entries. */
export async function deleteCategory(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM categories WHERE id = $1", [id]);
}
