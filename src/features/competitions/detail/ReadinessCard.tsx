import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import type { Readiness } from "../readiness";

export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { blocking, warnings } = readiness;

  return (
    <div className="mb-6 rounded-xl border bg-background p-4">
      {blocking.length === 0 ? (
        <p className="flex items-center gap-2 font-medium text-emerald-700">
          <CircleCheck className="size-4" /> Ready to start.
        </p>
      ) : (
        <>
          <p className="mb-2 font-medium">Before the competition can start:</p>
          <ul className="grid gap-1">
            {blocking.map((problem) => (
              <li key={problem} className="flex items-start gap-2 text-sm">
                <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" /> {problem}
              </li>
            ))}
          </ul>
        </>
      )}
      {warnings.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
