import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CategoryStandings } from "../standings";

const PODIUM = ["bg-amber-400/25", "bg-slate-400/25", "bg-orange-700/20"];

export function Leaderboard({ standings }: { standings: CategoryStandings }) {
  return (
    <div className="rounded-xl border bg-background">
      <p className="border-b px-4 py-3 font-semibold">Standings</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 pl-4">Place</TableHead>
            <TableHead>Athlete</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="pr-4 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.rows.map(({ entry, place, totalReps, complete }) => (
            <TableRow key={entry.id}>
              <TableCell className="pl-4">
                <span className={cn("inline-flex size-7 items-center justify-center rounded-full font-semibold tabular-nums", PODIUM[place - 1])}>
                  {place}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  {entry.lastName} {entry.firstName}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">#{entry.bibNumber}</span>
                {!complete && <span className="block text-xs text-muted-foreground">Results incomplete</span>}
              </TableCell>
              <TableCell>{entry.country}</TableCell>
              <TableCell className="pr-4 text-right font-semibold tabular-nums">{totalReps}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
