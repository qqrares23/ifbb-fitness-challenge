import type { CategoryRules } from "@/engine";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

export interface Category extends CategoryRules {
  id: number;
  name: string;
}

export type CategoryInput = Omit<Category, "id">;

const duplicateName = (input: CategoryInput) => ({ unique: `This competition already has a category named "${input.name.trim()}".` });

function values(input: CategoryInput) {
  return [input.name.trim(), input.gender, input.minAge, input.maxAge];
}

export async function listCategories(competitionId: number): Promise<Category[]> {
  return (await db()).select<Category[]>(
    `SELECT id, name, gender, min_age AS minAge, max_age AS maxAge
     FROM categories WHERE competition_id = $1
     ORDER BY name COLLATE NOCASE`,
    [competitionId],
  );
}

export async function createCategory({ competitionId, ...input }: CategoryInput & { competitionId: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute(
      "INSERT INTO categories (name, gender, min_age, max_age, competition_id) VALUES ($1, $2, $3, $4, $5)",
      [...values(input), competitionId],
    ),
    duplicateName(input),
  );
}

export async function updateCategory({ id, ...input }: Category): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE categories SET name = $1, gender = $2, min_age = $3, max_age = $4 WHERE id = $5", [
      ...values(input),
      id,
    ]),
    duplicateName(input),
  );
}

/** Also removes the category's entries. */
export async function deleteCategory(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM categories WHERE id = $1", [id]);
}
