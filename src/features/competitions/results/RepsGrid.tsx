import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommitNumberInput } from "@/components/shared/CommitInput";
import { MAX_REPS } from "@/db/scores";
import type { Station } from "@/db/stations";
import type { FitnessChallengeStandings } from "../standings";
import { useResultMutations } from "../useCompetitions";

interface RepsGridProps {
  competitionId: number;
  stations: Station[];
  standings: FitnessChallengeStandings;
  editable: boolean;
}

/** Athletes × stations, in bib order, so a judge can find an athlete without the rows moving as scores change. */
export function RepsGrid({ competitionId, stations, standings, editable }: RepsGridProps) {
  const { setScore } = useResultMutations(competitionId);
  const rows = [...standings.rows].sort((a, b) => a.entry.bibNumber - b.entry.bibNumber);

  return (
    <div className="overflow-x-auto surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Bib</TableHead>
            <TableHead>Athlete</TableHead>
            {stations.map((station) => (
              <TableHead key={station.stationNumber} className="text-center" title={station.exerciseName ?? undefined}>
                <span className="block">S{station.stationNumber}</span>
                <span className="block max-w-24 truncate text-xs font-normal text-muted-foreground">{station.exerciseName}</span>
              </TableHead>
            ))}
            <TableHead className="pr-4 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ entry, perStation, totalReps }) => (
            <TableRow key={entry.id}>
              <TableCell className="pl-4 font-semibold tabular-nums">{entry.bibNumber}</TableCell>
              <TableCell className="whitespace-nowrap">
                {entry.lastName} {entry.firstName}
              </TableCell>
              {stations.map(({ stationNumber }) => {
                const reps = perStation.get(stationNumber) ?? null;
                return (
                  <TableCell key={stationNumber} className="text-center tabular-nums">
                    {editable ? (
                      <CommitNumberInput
                        aria-label={`Reps for bib ${entry.bibNumber} at station ${stationNumber}`}
                        className="mx-auto w-16"
                        value={reps}
                        min={0}
                        max={MAX_REPS}
                        allowEmpty
                        onCommit={(value) => setScore.mutateAsync({ entryId: entry.id, stationNumber, reps: value })}
                      />
                    ) : (
                      (reps ?? "—")
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="pr-4 text-right font-semibold tabular-nums">{totalReps}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
