import { Trophy } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import type { Entry } from "@/db/entries";
import { countryName } from "@/lib/countries";
import { listName } from "@/lib/labels";
import { LateEntryBadge } from "../CompetitionBadges";

/** Row highlight for the category's current leader / winner. */
export const leaderRow = "bg-amber-50 hover:bg-amber-100/70";

/** Name (with the leader's trophy and a late-entry mark), country and club of a results row. */
export function AthleteCell({ entry, leader }: { entry: Entry; leader: boolean }) {
  return (
    <TableCell className="whitespace-nowrap">
      <span className="flex items-center gap-1.5 font-medium">
        {leader && <Trophy className="size-4 text-amber-600" aria-label="Leading" />}
        {listName(entry)}
        {entry.lateEntry && <LateEntryBadge />}
      </span>
      <span className="block text-xs text-muted-foreground">{[countryName(entry.country), entry.club].filter(Boolean).join(" · ")}</span>
    </TableCell>
  );
}
