import type { CategoryRules } from "@/engine";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/** A named set of category rules — the shape of both a library preset and a competition's category. */
export interface Category extends CategoryRules {
  id: number;
  name: string;
}

export type CategoryInput = Omit<Category, "id">;

export async function listCategories(competitionId: number): Promise<Category[]> {
  return (await db()).select<Category[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge
     FROM categories WHERE competition_id = $1
     ORDER BY name COLLATE NOCASE`,
    [competitionId],
  );
}

/** Copies the chosen library categories into a competition (a snapshot: later library edits don't affect it). */
export async function addCategoriesFromLibrary(args: { competitionId: number; presetIds: number[] }): Promise<void> {
  const conn = await db();
  for (const presetId of args.presetIds) {
    await withConstraintMessages(
      conn.execute(
        `INSERT INTO categories (competition_id, name, gender, min_age, max_age)
         SELECT $1, name, gender, min_age, max_age FROM category_presets WHERE id = $2`,
        [args.competitionId, presetId],
      ),
      { unique: "This competition already has a category with that name." },
    );
  }
}

/** Also removes the category's entries. */
export async function deleteCategory(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM categories WHERE id = $1", [id]);
}
