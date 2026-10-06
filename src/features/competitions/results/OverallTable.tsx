import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFlipAnimation } from "@/hooks/useFlipAnimation";
import { cn } from "@/lib/utils";
import { hasReps, type FitnessChallengeStandings } from "../standings";
import { AthleteCell, leaderRow } from "./AthleteCell";
import { PlaceBadge } from "./PlaceBadge";

/**
 * The overall ranking of a category scored on several station sets: each set's total and the
 * grand total, in ranking order. Read-only; reps are entered per set.
 */
export function OverallTable({ standings }: { standings: FitnessChallengeStandings }) {
  const rows = standings.overall ?? [];
  const flip = useFlipAnimation<HTMLTableRowElement>(rows.map((r) => r.entry.id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 pl-4">Place</TableHead>
          <TableHead className="w-14">Nr</TableHead>
          <TableHead>Athlete</TableHead>
          {standings.sets.map(({ stationSet }) => (
            <TableHead key={stationSet.id} className="text-center">
              {stationSet.name}
            </TableHead>
          ))}
          <TableHead className="pr-4 text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const ranked = hasReps(row);
          const leader = ranked && row.place === 1;
          return (
            <TableRow key={row.entry.id} ref={flip(row.entry.id)} className={cn("relative bg-card", leader && leaderRow)}>
              <TableCell className="pl-4">
                <PlaceBadge place={ranked ? row.place : null} />
              </TableCell>
              <TableCell className="font-semibold tabular-nums">{row.entry.bibNumber}</TableCell>
              <AthleteCell entry={row.entry} leader={leader} />
              {standings.sets.map(({ stationSet }, i) => (
                <TableCell key={stationSet.id} className="text-center tabular-nums">
                  {row.perStation.get(i) ?? "—"}
                </TableCell>
              ))}
              <TableCell className="pr-4 text-right text-base font-semibold tabular-nums">{row.totalReps}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
