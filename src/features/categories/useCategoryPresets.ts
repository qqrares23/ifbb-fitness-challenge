import { useQuery } from "@tanstack/react-query";
import {
  createCategoryPreset,
  deleteCategoryPreset,
  listCategoryPresets,
  updateCategoryPreset,
  type CategoryPreset,
} from "@/db/categoryPresets";
import { queryKeys } from "@/db/queryKeys";
import { useDbMutation } from "@/hooks/useDbMutation";

export function useCategoryPresets() {
  return useQuery({ queryKey: queryKeys.categoryPresets, queryFn: listCategoryPresets });
}

export function useCategoryPresetMutations() {
  // Competitions hold their own copy of each category, so library writes only touch the library.
  const invalidates = [queryKeys.categoryPresets];
  return {
    create: useDbMutation(createCategoryPreset, { invalidates, success: (c) => `"${c.name.trim()}" added.` }),
    update: useDbMutation(updateCategoryPreset, { invalidates, success: (c) => `"${c.name.trim()}" saved.` }),
    remove: useDbMutation((preset: CategoryPreset) => deleteCategoryPreset(preset.id), {
      invalidates,
      success: (c) => `"${c.name}" deleted.`,
    }),
  };
}
