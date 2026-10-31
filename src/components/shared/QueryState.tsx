import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}

/** Says that what's on screen may be out of date because the last refresh failed; nothing otherwise. */
export function RefreshFailed({ query }: { query: UseQueryResult<unknown> }) {
  if (!query.isRefetchError) return null;
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <p>This may be out of date, because it couldn't be refreshed: {errorMessage(query.error)}</p>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
        Try again
      </Button>
    </div>
  );
}

/** Renders the loading / error state of a query, and `children` once its data is in. */
export function QueryState<T>({ query, children }: QueryStateProps<T>) {
  // A failed refresh keeps the data it had (status "error"): the screen under it, and whatever is being typed there, stays.
  if (query.data !== undefined) {
    return (
      <>
        <RefreshFailed query={query} />
        {children(query.data)}
      </>
    );
  }
  if (query.status === "error") {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(query.error)}</p>;
  }
  return (
    <div className="flex justify-center py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
