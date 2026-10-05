import { Dumbbell } from "lucide-react";
import { LibraryPage } from "@/components/shared/LibraryPage";
import type { Exercise } from "@/db/exercises";
import { ExerciseFormDialog } from "./ExerciseFormDialog";
import { useExerciseMutations, useExercises } from "./useExercises";

export function ExercisesPage() {
  const { remove } = useExerciseMutations();

  return (
    <LibraryPage<Exercise>
      title="Exercises"
      description="The exercise library Fitness Challenge stations are built from."
      noun="exercise"
      emptyIcon={Dumbbell}
      emptyDescription="Add the exercises athletes will perform at the stations."
      query={useExercises()}
      columns={[
        { header: "Name", cell: (e) => e.name, className: "w-64 align-top" },
        { header: "Description", cell: (e) => e.description || "—", className: "whitespace-pre-wrap text-muted-foreground" },
      ]}
      searchPlaceholder="Search exercises…"
      searchFields={(e) => [e.name, e.description]}
      itemName={(e) => e.name}
      deleteNote="An exercise used by a competition station can't be deleted."
      onDelete={(exercise) => remove.mutate(exercise)}
      renderForm={({ item, open, onOpenChange }) => <ExerciseFormDialog exercise={item} open={open} onOpenChange={onOpenChange} />}
    />
  );
}
