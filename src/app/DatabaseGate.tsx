import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { errorMessage } from "@/lib/errors";

/** Opens the database (running any pending migrations) before rendering the app. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { status, error, refetch } = useQuery({ queryKey: ["database"], queryFn: db });

  if (status === "pending") {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert className="size-8 text-destructive" />
        <p className="font-medium">The local database could not be opened.</p>
        <p className="max-w-lg text-sm text-muted-foreground">{errorMessage(error)}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return children;
}
