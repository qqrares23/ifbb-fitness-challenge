import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeInput } from "@/components/shared/CommitInput";
import { formatDuration } from "@/engine";
import { countryName } from "@/lib/countries";
import type { SpeedFitStandings } from "../standings";
import { LateEntryBadge } from "../CompetitionBadges";
import { useResultMutations } from "../useCompetitions";
import { PlaceBadge } from "./PlaceBadge";

interface TimesTableProps {
  competitionId: number;
  standings: SpeedFitStandings;
  editable: boolean;
}

/** Speed Fit: one time per athlete, in bib order so rows don't move while times are typed. */
export function TimesTable({ competitionId, standings, editable }: TimesTableProps) {
  const { setTime } = useResultMutations(competitionId);
  const rows = [...standings.rows].sort((a, b) => a.entry.bibNumber - b.entry.bibNumber);

  return (
    <div className="overflow-hidden surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Bib</TableHead>
            <TableHead>Athlete</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="w-36 text-center">Time</TableHead>
            <TableHead className="w-16 pr-4 text-center">Place</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ entry, timeMs, place }) => (
            <TableRow key={entry.id}>
              <TableCell className="pl-4 font-semibold tabular-nums">{entry.bibNumber}</TableCell>
              <TableCell className="whitespace-nowrap font-medium">
                {entry.lastName} {entry.firstName}
                {entry.lateEntry && <LateEntryBadge />}
              </TableCell>
              <TableCell>
                {countryName(entry.country)} <span className="text-xs text-muted-foreground">{entry.country}</span>
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {editable ? (
                  <TimeInput
                    aria-label={`Time for bib ${entry.bibNumber}`}
                    className="mx-auto w-28"
                    value={timeMs}
                    allowEmpty
                    onCommit={(value) => setTime.mutateAsync({ entryId: entry.id, timeMs: value })}
                  />
                ) : timeMs === null ? (
                  "—"
                ) : (
                  formatDuration(timeMs)
                )}
              </TableCell>
              <TableCell className="pr-4 text-center">
                <PlaceBadge place={place} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
