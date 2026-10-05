import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/errors";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}

/** Renders the loading / error state of a query, and `children` once its data is in. */
export function QueryState<T>({ query, children }: QueryStateProps<T>) {
  if (query.status === "pending") {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (query.status === "error") {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(query.error)}</p>;
  }
  return children(query.data);
}
