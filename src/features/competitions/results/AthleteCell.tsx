import { Trophy } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import type { Entry } from "@/db/entries";
import { countryName } from "@/lib/countries";
import { entryClubs, entryListName } from "@/lib/labels";
import { LateEntryBadge } from "../CompetitionBadges";

/** Row highlight for the category's current leader / winner. */
export const leaderRow = "bg-amber-50 hover:bg-amber-100/70";

/** Name(s) (with the leader's trophy and a late-entry mark), countries and clubs of a results row. */
export function AthleteCell({ entry, leader }: { entry: Entry; leader: boolean }) {
  return (
    <TableCell className="whitespace-nowrap">
      <span className="flex items-center gap-1.5 font-medium">
        {leader && <Trophy className="size-4 text-amber-600" aria-label="Leading" />}
        {entryListName(entry)}
        {entry.lateEntry && <LateEntryBadge />}
      </span>
      <span className="block text-xs text-muted-foreground">{[[...new Set(entry.members.map((m) => countryName(m.country)))].join(" / "), entryClubs(entry)].filter(Boolean).join(" · ")}</span>
    </TableCell>
  );
}
