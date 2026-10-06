import { useQuery } from "@tanstack/react-query";
import {
  createAgeGroup,
  createLevel,
  createSubgroup,
  deleteAgeGroup,
  deleteLevel,
  deleteSubgroup,
  listCategoryLibrary,
  renameAgeGroup,
  renameLevel,
  updateSubgroup,
} from "@/db/categoryLibrary";
import { queryKeys } from "@/db/queryKeys";
import { useDbMutation } from "@/hooks/useDbMutation";

export function useCategoryLibrary() {
  return useQuery({ queryKey: queryKeys.categoryLibrary, queryFn: listCategoryLibrary });
}

export function useCategoryLibraryMutations() {
  // Competitions hold their own copy of each category, so library writes only touch the library.
  const invalidates = [queryKeys.categoryLibrary];
  return {
    createGroup: useDbMutation(createAgeGroup, { invalidates, success: ({ name }) => `"${name.trim()}" added.` }),
    renameGroup: useDbMutation(renameAgeGroup, { invalidates, success: ({ name }) => `"${name.trim()}" saved.` }),
    deleteGroup: useDbMutation(deleteAgeGroup, { invalidates, success: "Age group deleted." }),
    createSubgroup: useDbMutation(createSubgroup, { invalidates, success: "Sub-group added." }),
    updateSubgroup: useDbMutation(updateSubgroup, { invalidates, success: "Sub-group saved." }),
    deleteSubgroup: useDbMutation(deleteSubgroup, { invalidates, success: "Sub-group deleted." }),
    createLevel: useDbMutation(createLevel, { invalidates, success: ({ name }) => `Level "${name.trim()}" added.` }),
    renameLevel: useDbMutation(renameLevel, { invalidates, success: ({ name }) => `Level "${name.trim()}" saved.` }),
    deleteLevel: useDbMutation(deleteLevel, { invalidates, success: "Level deleted." }),
  };
}
