import type { CategoryRules } from "@/engine";
import { categoryName } from "@/lib/labels";
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

export async function listCategories(competitionId: number): Promise<Category[]> {
  // Added in library order, so id order keeps sub-groups and their levels together.
  return (await db()).select<Category[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge, age_group AS ageGroup, level
     FROM categories WHERE competition_id = $1
     ORDER BY id`,
    [competitionId],
  );
}

/** Copies the chosen library levels into a competition (a snapshot: later library edits don't affect it). */
export async function addCategoriesFromLibrary(args: { competitionId: number; levelIds: number[] }): Promise<void> {
  const conn = await db();
  for (const levelId of args.levelIds) {
    const [row] = await conn.select<(CategoryRules & { ageGroup: string; level: string })[]>(
      `SELECT g.name AS ageGroup, s.gender, s.min_age AS minAge, s.max_age AS maxAge, l.name AS level
       FROM category_levels l
       JOIN age_subgroups s ON s.id = l.subgroup_id
       JOIN age_groups g ON g.id = s.age_group_id
       WHERE l.id = $1`,
      [levelId],
    );
    if (!row) continue; // deleted from the library meanwhile
    await withConstraintMessages(
      conn.execute(
        `INSERT INTO categories (competition_id, name, gender, min_age, max_age, age_group, level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [args.competitionId, categoryName(row.ageGroup, row, row.level), row.gender, row.minAge, row.maxAge, row.ageGroup, row.level],
      ),
      { unique: "This competition already has a category with that name." },
    );
  }
}

/** Also removes the category's entries. */
export async function deleteCategory(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM categories WHERE id = $1", [id]);
}
