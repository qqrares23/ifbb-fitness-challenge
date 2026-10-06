import { useQuery } from "@tanstack/react-query";
import { addCategoriesFromLibrary, deleteCategory, setCategoryStationSet, updateCategoryRules } from "@/db/categories";
import {
  createCompetition,
  deleteCompetition,
  getCompetitionSetup,
  listCompetitions,
  setCompetitionStatus,
  updateCompetition,
  type Competition,
  type CompetitionStatus,
} from "@/db/competitions";
import { addEntries, deleteEntry, setEntryBib, setEntryCategory } from "@/db/entries";
import { queryKeys } from "@/db/queryKeys";
import { listResults } from "@/db/results";
import { setScore } from "@/db/scores";
import { setTime } from "@/db/speedFitTimes";
import { createStationSet, deleteStationSet, renameStationSet, setStationCount, setStationExercise } from "@/db/stations";
import { useDbMutation } from "@/hooks/useDbMutation";

// Every write below touches data shown under the `competitions` root (list counts + setup);
// results are nested under it, so removing stations or categories refreshes them too.
const invalidates = [queryKeys.competitions];

export function useCompetitions() {
  return useQuery({ queryKey: queryKeys.competitions, queryFn: listCompetitions });
}

export function useCompetitionSetup(id: number) {
  return useQuery({ queryKey: queryKeys.competition(id), queryFn: () => getCompetitionSetup(id) });
}

const STATUS_SUCCESS: Record<CompetitionStatus, string> = {
  draft: "",
  // "running" is also reached by reopening a finished competition.
  running: "Rep entry is open.",
  finished: "Competition finished.",
};

export function useCompetitionMutations() {
  return {
    create: useDbMutation(createCompetition, { invalidates, success: "Competition created." }),
    update: useDbMutation(updateCompetition, { invalidates, success: "Competition details saved." }),
    remove: useDbMutation(deleteCompetition, { invalidates, success: "Competition deleted." }),
    setStatus: useDbMutation(
      ({ id, status }: { id: number; status: CompetitionStatus }) => setCompetitionStatus(id, status),
      { invalidates, success: ({ status }) => STATUS_SUCCESS[status] },
    ),
  };
}

export function useStationMutations() {
  return {
    createSet: useDbMutation(createStationSet, { invalidates, success: "Station set added." }),
    renameSet: useDbMutation(renameStationSet, { invalidates, success: ({ name }) => `Renamed to "${name.trim()}".` }),
    deleteSet: useDbMutation(deleteStationSet, { invalidates, success: "Station set deleted." }),
    setCount: useDbMutation(setStationCount, { invalidates }),
    setExercise: useDbMutation(setStationExercise, { invalidates }),
  };
}

export function useCategoryMutations() {
  const count = (n: number) => `${n} categor${n === 1 ? "y" : "ies"}`;
  return {
    addFromLibrary: useDbMutation(addCategoriesFromLibrary, { invalidates, success: ({ levelIds, subgroupIds }) => `${count(levelIds.length + subgroupIds.length)} added.` }),
    remove: useDbMutation(deleteCategory, { invalidates, success: "Category removed from the competition." }),
    setStationSet: useDbMutation(setCategoryStationSet, { invalidates }),
    updateRules: useDbMutation(updateCategoryRules, { invalidates, success: "Category rules saved." }),
  };
}

export function useCompetitionResults(competition: Pick<Competition, "id" | "kind">, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.competitionResults(competition.id), queryFn: () => listResults(competition), enabled });
}

export function useResultMutations(competitionId: number) {
  const invalidates = [queryKeys.competitionResults(competitionId)];
  return {
    setScore: useDbMutation(setScore, { invalidates }),
    setTime: useDbMutation(setTime, { invalidates }),
  };
}

export function useEntryMutations() {
  return {
    add: useDbMutation(addEntries, {
      invalidates,
      success: ({ athleteIds }) => `${athleteIds.length} athlete${athleteIds.length === 1 ? "" : "s"} entered.`,
    }),
    setCategory: useDbMutation(setEntryCategory, { invalidates }),
    setBib: useDbMutation(setEntryBib, { invalidates }),
    remove: useDbMutation(deleteEntry, { invalidates, success: "Athlete removed from the competition." }),
  };
}
