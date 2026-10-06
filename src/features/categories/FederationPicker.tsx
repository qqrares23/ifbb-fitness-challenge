import type { Federation } from "@/db/categoryLibrary";
import { FEDERATION_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** IFBB / Romania switch: which federation's category library is shown. */
export function FederationPicker({ value, onChange, className }: { value: Federation; onChange: (federation: Federation) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Federation" className={cn("inline-flex rounded-xl border bg-card p-1 shadow-sm", className)}>
      {(Object.keys(FEDERATION_LABELS) as Federation[]).map((federation) => (
        <button
          key={federation}
          type="button"
          role="radio"
          aria-checked={value === federation}
          onClick={() => onChange(federation)}
          className={cn(
            "rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200",
            value === federation ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {FEDERATION_LABELS[federation]} categories
        </button>
      ))}
    </div>
  );
}
