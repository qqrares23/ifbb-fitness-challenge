import type { CategoryRules } from "@/engine";
import { db } from "./client";
import { withConstraintMessages } from "./errors";

/** Age group (Junior, Senior…) → sub-groups by sex and age → levels (Bronze, Silver…). */
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

/** The whole library as a tree, everything in the order it was created. */
export async function listCategoryLibrary(): Promise<AgeGroup[]> {
  const conn = await db();
  const [groups, subgroups, levels] = await Promise.all([
    conn.select<Omit<AgeGroup, "subgroups">[]>("SELECT id, name FROM age_groups ORDER BY id"),
    conn.select<Omit<AgeSubgroup, "levels">[]>(
      "SELECT id, age_group_id AS ageGroupId, gender, min_age AS minAge, max_age AS maxAge FROM age_subgroups ORDER BY id",
    ),
    conn.select<CategoryLevel[]>("SELECT id, subgroup_id AS subgroupId, name FROM category_levels ORDER BY id"),
  ]);
  const tree = groups.map((g) => ({ ...g, subgroups: [] as AgeSubgroup[] }));
  const subgroupById = new Map<number, AgeSubgroup>();
  for (const s of subgroups) {
    const subgroup = { ...s, levels: [] };
    subgroupById.set(s.id, subgroup);
    tree.find((g) => g.id === s.ageGroupId)?.subgroups.push(subgroup);
  }
  for (const level of levels) subgroupById.get(level.subgroupId)?.levels.push(level);
  return tree;
}

const duplicateGroup = (name: string) => ({ unique: `An age group named "${name.trim()}" already exists.` });
const duplicateLevel = (name: string) => ({ unique: `This sub-group already has a level named "${name.trim()}".` });

export async function createAgeGroup({ name }: { name: string }): Promise<void> {
  await withConstraintMessages((await db()).execute("INSERT INTO age_groups (name) VALUES ($1)", [name.trim()]), duplicateGroup(name));
}

export async function renameAgeGroup({ id, name }: { id: number; name: string }): Promise<void> {
  await withConstraintMessages((await db()).execute("UPDATE age_groups SET name = $1 WHERE id = $2", [name.trim(), id]), duplicateGroup(name));
}

/** Also deletes its sub-groups and levels. Competitions keep their own copies. */
export async function deleteAgeGroup(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM age_groups WHERE id = $1", [id]);
}

const duplicateSubgroup = { unique: "This age group already has a sub-group with that sex and ages." };

export async function createSubgroup({ ageGroupId, gender, minAge, maxAge }: CategoryRules & { ageGroupId: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO age_subgroups (age_group_id, gender, min_age, max_age) VALUES ($1, $2, $3, $4)", [ageGroupId, gender, minAge, maxAge]),
    duplicateSubgroup,
  );
}

export async function updateSubgroup({ id, gender, minAge, maxAge }: CategoryRules & { id: number }): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE age_subgroups SET gender = $1, min_age = $2, max_age = $3 WHERE id = $4", [gender, minAge, maxAge, id]),
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
