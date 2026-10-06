import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFlipAnimation } from "@/hooks/useFlipAnimation";
import { listName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "../standings";
import { PlaceBadge } from "./PlaceBadge";

interface LeaderboardProps {
  rows: LeaderboardRow[];
  /** Header of the ranking column, e.g. "Total reps" or "Time". */
  valueLabel: string;
}

/** Live standings; rows glide to their new place as results come in. */
export function Leaderboard({ rows, valueLabel }: LeaderboardProps) {
  const flip = useFlipAnimation<HTMLTableRowElement>(rows.map((r) => r.entry.id));

  return (
    <div className="overflow-hidden surface">
      <p className="border-b bg-muted/40 px-4 py-3 font-semibold">Standings</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 pl-4">Place</TableHead>
            <TableHead>Athlete</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="pr-4 text-right">{valueLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ entry, place, value, ranked, note }) => (
            <TableRow
              key={entry.id}
              ref={flip(entry.id)}
              className={cn("relative bg-card", ranked && place === 1 && "bg-amber-50 hover:bg-amber-100/70")}
            >
              <TableCell className="pl-4">
                <PlaceBadge place={ranked ? place : null} />
              </TableCell>
              <TableCell>
                <span className="font-medium">{listName(entry)}</span>
                <span className="ml-2 text-xs text-muted-foreground">#{entry.bibNumber}</span>
                {note && <span className="block text-xs text-muted-foreground">{note}</span>}
              </TableCell>
              <TableCell>{entry.country}</TableCell>
              <TableCell className="pr-4 text-right font-semibold tabular-nums">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
