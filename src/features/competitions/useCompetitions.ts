import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addCategoriesFromLibrary, deleteCategory, setCategoryUsesStationSet, updateCategoryRules } from "@/db/categories";
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
import { addEntries, addTeamEntry, deleteEntry, setEntryBib, setEntryCategory } from "@/db/entries";
import { queryKeys } from "@/db/queryKeys";
import { clearResults, listResults, type RecordedResults } from "@/db/results";
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
  // Only reached by restarting.
  draft: "Competition restarted: results deleted, setup kept.",
  // "running" is also reached by reopening a finished competition.
  running: "Rep entry is open.",
  finished: "Competition finished.",
};

export function useCompetitionMutations() {
  return {
    create: useDbMutation(createCompetition, { invalidates, success: "Competition created." }),
    update: useDbMutation(updateCompetition, { invalidates, success: "Competition details saved." }),
    remove: useDbMutation(deleteCompetition, { invalidates, success: "Competition deleted." }),
    clearResults: useDbMutation(clearResults, { invalidates, success: "All results deleted." }),
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
    setUsesStationSet: useDbMutation(setCategoryUsesStationSet, { invalidates }),
    updateRules: useDbMutation(updateCategoryRules, { invalidates, success: "Category rules saved." }),
  };
}

export function useCompetitionResults(competition: Pick<Competition, "id" | "kind">, enabled: boolean) {
  // Poll while results are shown so writes from judges hosted on the network appear here too.
  return useQuery({ queryKey: queryKeys.competitionResults(competition.id), queryFn: () => listResults(competition), enabled, refetchInterval: enabled ? 3000 : false });
}

export function useResultMutations(competitionId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.competitionResults(competitionId);
  const invalidates = [key];

  // Shows a result in the cached standings (re-ranked at once) before it is saved; the refetch
  // after the save confirms it, and a failed save refetches what the database really has.
  function optimistic<A>(save: (args: A) => Promise<void>, apply: (results: RecordedResults, args: A) => RecordedResults) {
    return async (args: A) => {
      // A refresh still in flight from an earlier save would overwrite this result with older data.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<RecordedResults>(key, (results) => results && apply(results, args));
      try {
        await save(args);
      } catch (error) {
        void queryClient.invalidateQueries({ queryKey: key });
        throw error;
      }
    };
  }

  return {
    setScore: useDbMutation(
      optimistic(setScore, (results, { entryId, setId, stationNumber, reps }) => {
        if (results.kind !== "fitness_challenge") return results;
        const others = results.scores.filter((s) => !(s.entryId === entryId && s.setId === setId && s.stationNumber === stationNumber));
        return { ...results, scores: reps === null ? others : [...others, { entryId, setId, stationNumber, reps }] };
      }),
      { invalidates },
    ),
    setTime: useDbMutation(
      optimistic(setTime, (results, { entryId, timeMs }) => {
        if (results.kind !== "speed_fit") return results;
        const others = results.times.filter((t) => t.entryId !== entryId);
        return { ...results, times: timeMs === null ? others : [...others, { entryId, timeMs }] };
      }),
      { invalidates },
    ),
  };
}

export function useEntryMutations() {
  return {
    add: useDbMutation(addEntries, {
      invalidates,
      success: ({ athleteIds }) => `${athleteIds.length} athlete${athleteIds.length === 1 ? "" : "s"} entered.`,
    }),
    addTeam: useDbMutation(addTeamEntry, { invalidates, success: ({ size }) => `${size === 2 ? "Couple" : "Team"} entered.` }),
    setCategory: useDbMutation(setEntryCategory, { invalidates }),
    setBib: useDbMutation(setEntryBib, { invalidates }),
    remove: useDbMutation(deleteEntry, { invalidates, success: "Removed from the competition." }),
  };
}
