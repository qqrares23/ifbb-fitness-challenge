import type { Category, CategoryInput } from "./categories";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/** A category in the library; same shape as a competition's category. */
export type CategoryPreset = Category;

const duplicateName = (input: CategoryInput) => ({ unique: `A category named "${input.name.trim()}" already exists.` });

function values(input: CategoryInput) {
  return [input.name.trim(), input.gender, input.minAge, input.maxAge];
}

export async function listCategoryPresets(): Promise<CategoryPreset[]> {
  return (await db()).select<CategoryPreset[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge
     FROM category_presets ORDER BY name COLLATE NOCASE`,
  );
}

export async function createCategoryPreset(input: CategoryInput): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO category_presets (name, gender, min_age, max_age) VALUES ($1, $2, $3, $4)", values(input)),
    duplicateName(input),
  );
}

export async function updateCategoryPreset({ id, ...input }: CategoryPreset): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE category_presets SET name = $1, gender = $2, min_age = $3, max_age = $4 WHERE id = $5", [
      ...values(input),
      id,
    ]),
    duplicateName(input),
  );
}

/** Competitions keep their own copy, so a preset can always be deleted. */
export async function deleteCategoryPreset(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM category_presets WHERE id = $1", [id]);
}
