import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeInput } from "@/components/shared/CommitInput";
import { formatDuration } from "@/engine";
import { useFlipAnimation } from "@/hooks/useFlipAnimation";
import { cn } from "@/lib/utils";
import type { SpeedFitStandings } from "../standings";
import { useResultMutations } from "../useCompetitions";
import { AthleteCell, leaderRow } from "./AthleteCell";
import { PlaceBadge } from "./PlaceBadge";

interface TimesTableProps {
  competitionId: number;
  standings: SpeedFitStandings;
  editable: boolean;
}

/** Speed Fit: one time per athlete, fastest first; rows glide into place as times come in. */
export function TimesTable({ competitionId, standings, editable }: TimesTableProps) {
  const { setTime } = useResultMutations(competitionId);
  const { rows } = standings;
  const flip = useFlipAnimation<HTMLTableRowElement>(rows.map((r) => r.entry.id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 pl-4">Place</TableHead>
          <TableHead className="w-14">Nr</TableHead>
          <TableHead>Athlete</TableHead>
          <TableHead className="w-36 pr-4 text-center">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ entry, timeMs, place }) => {
          const leader = place === 1;
          return (
            <TableRow key={entry.id} ref={flip(entry.id)} className={cn("relative bg-card", leader && leaderRow)}>
              <TableCell className="pl-4">
                <PlaceBadge place={place} />
              </TableCell>
              <TableCell className="font-semibold tabular-nums">{entry.bibNumber}</TableCell>
              <AthleteCell entry={entry} leader={leader} />
              <TableCell className="pr-4 text-center tabular-nums">
                {editable ? (
                  <TimeInput
                    aria-label={`Time for Nr ${entry.bibNumber}`}
                    className="mx-auto w-28"
                    value={timeMs}
                    allowEmpty
                    onCommit={(value) => setTime.mutateAsync({ entryId: entry.id, timeMs: value })}
                  />
                ) : timeMs === null ? (
                  "—"
                ) : (
                  <span className="text-base font-semibold">{formatDuration(timeMs)}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
