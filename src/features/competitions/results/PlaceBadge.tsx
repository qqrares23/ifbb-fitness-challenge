import { cn } from "@/lib/utils";

const PODIUM = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm shadow-amber-500/40",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
  "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950",
];

/** A round place marker; 1st–3rd get podium colours. null = not placed yet. */
export function PlaceBadge({ place }: { place: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-300",
        place === null ? "text-muted-foreground" : (PODIUM[place - 1] ?? "bg-muted"),
      )}
    >
      {place ?? "—"}
    </span>
  );
}
