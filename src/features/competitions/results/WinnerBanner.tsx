import { Trophy } from "lucide-react";
import { countryName } from "@/lib/countries";
import type { LeaderboardRow } from "../standings";

/** The current leader(s) of a category, updated live. Hidden until someone has a result. */
export function WinnerBanner({ rows, finished }: { rows: LeaderboardRow[]; finished: boolean }) {
  const leaders = rows.filter((r) => r.ranked && r.place === 1);
  if (leaders.length === 0) return null;

  return (
    // Keyed by the leaders so the banner re-enters (and draws the eye) whenever the lead changes.
    <div
      key={leaders.map((l) => l.entry.id).join()}
      className="relative flex animate-in items-center gap-4 overflow-hidden rounded-xl border border-amber-300/70 bg-gradient-to-r from-amber-50 via-amber-100/60 to-background p-4 shadow-sm fade-in-0 zoom-in-95 duration-500"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-md shadow-amber-500/30">
        <Trophy className="size-6 text-amber-950" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase">
          {finished ? "Winner" : "Leading now"}
          {leaders.length > 1 && " · tie"}
        </p>
        {leaders.map(({ entry, value }) => (
          <p key={entry.id} className="truncate">
            <span className="font-heading text-lg font-semibold">
              {entry.firstName} {entry.lastName}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">{countryName(entry.country)}</span>
            <span className="ml-3 font-semibold tabular-nums">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
