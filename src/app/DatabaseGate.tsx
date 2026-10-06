import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hasDatabaseBackup, restoreDatabaseBackup } from "@/db/backup";
import { db } from "@/db/client";
import { errorMessage } from "@/lib/errors";

/** Opens the database (running any pending migrations) before rendering the app. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { status, error, refetch } = useQuery({ queryKey: ["database"], queryFn: db });
  // After an import that won't open, the database from before it can be put back.
  const backup = useQuery({ queryKey: ["database-backup"], queryFn: hasDatabaseBackup, enabled: status === "error" });

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
          {backup.data && (
            <Button onClick={() => restoreDatabaseBackup().catch((e: unknown) => toast.error(errorMessage(e)))}>
              Restore the database from before the last import
            </Button>
          )}
        </div>
      </div>
    );
  }

  return children;
}
