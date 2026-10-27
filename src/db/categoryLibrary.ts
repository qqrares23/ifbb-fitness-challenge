import type { CategoryRules } from "@/engine";
import { db } from "./client";
import type { CompetitionKind } from "./competitions";
import { withConstraintMessages } from "./errors";

/** Whose categories a library holds. */
export type Federation = "ifbb" | "romania";

/** One category library: a federation's categories for one challenge type. */
export interface LibraryKey {
  federation: Federation;
  kind: CompetitionKind;
}

/**
 * Age group (Junior, Senior…) → sub-groups by sex and age → levels (Bronze, Silver…).
 * Each federation (IFBB, Romania) has a library per challenge type (Fitness Challenge, Speed Fit).
 * A sub-group with no levels is a category on its own (common for Speed Fit). A sub-group is for
 * individuals, couples or teams.
 */
export interface AgeGroup {
  id: number;
  name: string;
  subgroups: AgeSubgroup[];
}

export interface AgeSubgroup extends CategoryRules {
  id: number;
  ageGroupId: number;
  levels: CategoryLevel[];
}

export interface CategoryLevel {
  id: number;
  subgroupId: number;
  name: string;
}

/** One library as a tree, everything in the order it was created. */
export async function listCategoryLibrary({ federation, kind }: LibraryKey): Promise<AgeGroup[]> {
  const conn = await db();
  const inLibrary = "SELECT id FROM age_groups WHERE federation = $1 AND kind = $2";
  const [groups, subgroups, levels] = await Promise.all([
    conn.select<Omit<AgeGroup, "subgroups">[]>("SELECT id, name FROM age_groups WHERE federation = $1 AND kind = $2 ORDER BY id", [federation, kind]),
    conn.select<Omit<AgeSubgroup, "levels">[]>(
      `SELECT id, age_group_id AS ageGroupId, format, gender, min_age AS minAge, max_age AS maxAge FROM age_subgroups
       WHERE age_group_id IN (${inLibrary}) ORDER BY id`,
      [federation, kind],
    ),
    conn.select<CategoryLevel[]>(
      `SELECT l.id, l.subgroup_id AS subgroupId, l.name FROM category_levels l JOIN age_subgroups s ON s.id = l.subgroup_id
       WHERE s.age_group_id IN (${inLibrary}) ORDER BY l.id`,
      [federation, kind],
    ),
  ]);
  const groupById = new Map(groups.map((g) => [g.id, { ...g, subgroups: [] as AgeSubgroup[] }]));
  const subgroupById = new Map<number, AgeSubgroup>();
  for (const s of subgroups) {
    const subgroup = { ...s, levels: [] };
    subgroupById.set(s.id, subgroup);
    groupById.get(s.ageGroupId)?.subgroups.push(subgroup);
  }
  for (const level of levels) subgroupById.get(level.subgroupId)?.levels.push(level);
  return [...groupById.values()];
}

const duplicateGroup = (name: string) => ({ unique: `This library already has an age group named "${name.trim()}".` });
const duplicateLevel = (name: string) => ({ unique: `This sub-group already has a level named "${name.trim()}".` });

export async function createAgeGroup({ federation, kind, name }: LibraryKey & { name: string }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO age_groups (federation, kind, name) VALUES ($1, $2, $3)", [federation, kind, name.trim()]),
    duplicateGroup(name),
  );
}

export async function renameAgeGroup({ id, name }: { id: number; name: string }): Promise<void> {
  await withConstraintMessages((await db()).execute("UPDATE age_groups SET name = $1 WHERE id = $2", [name.trim(), id]), duplicateGroup(name));
}

/** Also deletes its sub-groups and levels. Competitions keep their own copies. */
export async function deleteAgeGroup(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM age_groups WHERE id = $1", [id]);
}

const duplicateSubgroup = { unique: "This age group already has a sub-group with that type, sex and ages." };

export async function createSubgroup({ ageGroupId, format, gender, minAge, maxAge }: CategoryRules & { ageGroupId: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO age_subgroups (age_group_id, format, gender, min_age, max_age) VALUES ($1, $2, $3, $4, $5)", [ageGroupId, format, gender, minAge, maxAge]),
    duplicateSubgroup,
  );
}

export async function updateSubgroup({ id, format, gender, minAge, maxAge }: CategoryRules & { id: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE age_subgroups SET format = $1, gender = $2, min_age = $3, max_age = $4 WHERE id = $5", [format, gender, minAge, maxAge, id]),
    duplicateSubgroup,
  );
}

/** Also deletes its levels. */
export async function deleteSubgroup(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM age_subgroups WHERE id = $1", [id]);
}

export async function createLevel({ subgroupId, name }: { subgroupId: number; name: string }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO category_levels (subgroup_id, name) VALUES ($1, $2)", [subgroupId, name.trim()]),
    duplicateLevel(name),
  );
}

export async function renameLevel({ id, name }: { id: number; name: string }): Promise<void> {
  await withConstraintMessages((await db()).execute("UPDATE category_levels SET name = $1 WHERE id = $2", [name.trim(), id]), duplicateLevel(name));
}

export async function deleteLevel(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM category_levels WHERE id = $1", [id]);
}
