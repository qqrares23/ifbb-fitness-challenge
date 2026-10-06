import { db } from "./client";
import { withConstraintMessages } from "./errors";

export interface Exercise {
  id: number;
  name: string;
  /** Image data URL showing how the exercise is performed; null = no photo. */
  photo: string | null;
}

export type ExerciseInput = Omit<Exercise, "id">;

function values(input: ExerciseInput) {
  return [input.name.trim(), input.photo];
}

const duplicateName = (input: ExerciseInput) => ({ unique: `An exercise named "${input.name.trim()}" already exists.` });

export async function listExercises(): Promise<Exercise[]> {
  return (await db()).select<Exercise[]>("SELECT id, name, photo FROM exercises ORDER BY name COLLATE NOCASE");
}

export async function createExercise(input: ExerciseInput): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("INSERT INTO exercises (name, photo) VALUES ($1, $2)", values(input)),
    duplicateName(input),
  );
}

export async function updateExercise({ id, ...input }: Exercise): Promise<void> {
  await withConstraintMessages(
    (await db()).execute("UPDATE exercises SET name = $1, photo = $2 WHERE id = $3", [...values(input), id]),
    duplicateName(input),
  );
}

export async function deleteExercise(id: number): Promise<void> {
  await withConstraintMessages((await db()).execute("DELETE FROM exercises WHERE id = $1", [id]), {
    foreignKey: "This exercise is used by a competition station and can't be deleted.",
  });
}
