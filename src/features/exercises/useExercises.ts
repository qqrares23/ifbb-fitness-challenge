import { useQuery } from "@tanstack/react-query";
import { createExercise, deleteExercise, listExercises, updateExercise, type Exercise } from "@/db/exercises";
import { queryKeys } from "@/db/queryKeys";
import { useDbMutation } from "@/hooks/useDbMutation";

export function useExercises() {
  return useQuery({ queryKey: queryKeys.exercises, queryFn: listExercises });
}

export function useExerciseMutations() {
  // Competition screens show exercise details too.
  const invalidates = [queryKeys.exercises, queryKeys.competitions];
  return {
    create: useDbMutation(createExercise, { invalidates, success: (e) => `"${e.name.trim()}" added.` }),
    update: useDbMutation(updateExercise, { invalidates, success: (e) => `"${e.name.trim()}" updated.` }),
    remove: useDbMutation((exercise: Exercise) => deleteExercise(exercise.id), {
      invalidates,
      success: (e) => `"${e.name}" deleted.`,
    }),
  };
}
