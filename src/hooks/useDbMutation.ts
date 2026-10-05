import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

interface Options<TArgs> {
  /** Query roots whose cached data this write changes. */
  invalidates: readonly QueryKey[];
  success?: string | ((args: TArgs) => string);
}

/** A database write that refreshes what it changed and reports success / failure as a toast. */
export function useDbMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>, { invalidates, success }: Options<TArgs>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_result, args) => {
      await Promise.all(invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      const message = typeof success === "function" ? success(args) : success;
      if (message) toast.success(message);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
