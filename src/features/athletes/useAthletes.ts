import { useQuery } from "@tanstack/react-query";
import { createAthlete, deleteAthlete, listAthletes, updateAthlete, type Athlete } from "@/db/athletes";
import { queryKeys } from "@/db/queryKeys";
import { useDbMutation } from "@/hooks/useDbMutation";
import { fullName } from "@/lib/labels";

export function useAthletes() {
  return useQuery({ queryKey: queryKeys.athletes, queryFn: listAthletes });
}

export function useAthleteMutations() {
  // Competition screens show athlete details too.
  const invalidates = [queryKeys.athletes, queryKeys.competitions];
  return {
    create: useDbMutation(createAthlete, { invalidates, success: (a) => `${fullName(a)} added.` }),
    update: useDbMutation(updateAthlete, { invalidates, success: (a) => `${fullName(a)} updated.` }),
    remove: useDbMutation((athlete: Athlete) => deleteAthlete(athlete.id), {
      invalidates,
      success: (a) => `${fullName(a)} deleted.`,
    }),
  };
}
