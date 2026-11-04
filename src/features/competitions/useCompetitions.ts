import { useEffect } from "react";
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
import { judgeServerStatus } from "@/db/hosting";
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
  running: "Results entry is open.",
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

export function useCompetitionResults(competition: Pick<Competition, "id" | "status">, enabled: boolean) {
  const queryClient = useQueryClient();
  const { id, status } = competition;
  const hosting = useQuery({ queryKey: queryKeys.judgeServer, queryFn: judgeServerStatus }).data?.running;
  // Poll while judges hosted on the network can write, so their results appear here too. Not while
  // a field has focus or a save is under way: re-ranking moves rows, which could take the focus away.
  // (Rows also hold still while a field is typed in, see useHeldWhileTyping, whatever brings new results.)
  // shortcut: a field left focused also holds back phone results, until it loses focus; compare typed text with the saved value if that ever matters.
  useEffect(() => {
    if (status !== "running" || !hosting) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.competitionResults(id), exact: true });
    const timer = setInterval(() => {
      if (document.activeElement instanceof HTMLInputElement || queryClient.isMutating() > 0) return;
      refresh();
    }, 3000);
    return () => {
      clearInterval(timer);
      refresh(); // what the phones saved since the last poll
    };
  }, [queryClient, id, status, hosting]);
  return useQuery({ queryKey: queryKeys.competitionResults(id), queryFn: () => listResults(id), enabled });
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
        const others = results.scores.filter((s) => !(s.entryId === entryId && s.setId === setId && s.stationNumber === stationNumber));
        return { ...results, scores: reps === null ? others : [...others, { entryId, setId, stationNumber, reps }] };
      }),
      { invalidates },
    ),
    setTime: useDbMutation(
      optimistic(setTime, (results, { entryId, timeMs }) => {
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
