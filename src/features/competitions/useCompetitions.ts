import { useQuery } from "@tanstack/react-query";
import { createCategory, deleteCategory, updateCategory } from "@/db/categories";
import {
  createCompetition,
  deleteCompetition,
  getCompetitionSetup,
  listCompetitions,
  setCompetitionStatus,
  updateCompetition,
  type CompetitionStatus,
} from "@/db/competitions";
import { addEntries, deleteEntry, setEntryBib, setEntryCategory } from "@/db/entries";
import { queryKeys } from "@/db/queryKeys";
import { listScores, setScore } from "@/db/scores";
import { setStationCount, setStationExercise } from "@/db/stations";
import { useDbMutation } from "@/hooks/useDbMutation";

// Every write below touches data shown under the `competitions` root (list counts + setup).
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
    setCount: useDbMutation(setStationCount, { invalidates }),
    setExercise: useDbMutation(setStationExercise, { invalidates }),
  };
}

export function useCategoryMutations() {
  return {
    create: useDbMutation(createCategory, { invalidates, success: (c) => `"${c.name.trim()}" added.` }),
    update: useDbMutation(updateCategory, { invalidates, success: (c) => `"${c.name.trim()}" saved.` }),
    remove: useDbMutation(deleteCategory, { invalidates, success: "Category deleted." }),
  };
}

export function useCompetitionScores(id: number, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.competitionScores(id), queryFn: () => listScores(id), enabled });
}

export function useScoreMutation(competitionId: number) {
  return useDbMutation(setScore, { invalidates: [queryKeys.competitionScores(competitionId)] });
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
