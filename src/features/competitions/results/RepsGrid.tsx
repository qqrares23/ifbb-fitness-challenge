import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommitNumberInput } from "@/components/shared/CommitInput";
import { MAX_REPS } from "@/db/scores";
import { PhotoHint } from "@/features/exercises/ExercisePhotoButton";
import { useExercises } from "@/features/exercises/useExercises";
import { useFlipAnimation } from "@/hooks/useFlipAnimation";
import { cn } from "@/lib/utils";
import type { FitnessChallengeStandings } from "../standings";
import { useResultMutations } from "../useCompetitions";
import { AthleteCell, leaderRow } from "./AthleteCell";
import { PlaceBadge } from "./PlaceBadge";

interface RepsGridProps {
  competitionId: number;
  standings: FitnessChallengeStandings;
  editable: boolean;
}

/**
 * Athletes × the stations of their category's set, in ranking order: rows move up as reps come
 * in (gliding, so a judge can follow them). Athletes without any reps yet are unplaced.
 */
export function RepsGrid({ competitionId, standings, editable }: RepsGridProps) {
  const { setScore } = useResultMutations(competitionId);
  const photos = new Map((useExercises().data ?? []).map((e) => [e.id, e.photo]));
  const { stationSet, rows } = standings;
  const flip = useFlipAnimation<HTMLTableRowElement>(rows.map((r) => r.entry.id));
  if (!stationSet) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Pick a station set for this category in the Categories tab.</p>;
  }
  const { stations } = stationSet;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 pl-4">Place</TableHead>
          <TableHead className="w-14">Nr</TableHead>
          <TableHead>Athlete</TableHead>
          {stations.map((station) => (
            <TableHead key={station.stationNumber} className="text-center" title={station.exerciseName ?? undefined}>
              <span className="block">S{station.stationNumber}</span>
              <span className="flex max-w-28 items-center justify-center gap-1 text-xs font-normal text-muted-foreground">
                <span className="truncate">{station.exerciseName}</span>
                {station.exerciseId !== null && <PhotoHint name={station.exerciseName ?? ""} photo={photos.get(station.exerciseId) ?? null} />}
              </span>
            </TableHead>
          ))}
          <TableHead className="pr-4 text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ entry, perStation, totalReps, place }) => {
          const ranked = [...perStation.values()].some((reps) => reps !== null);
          const leader = ranked && place === 1;
          return (
            <TableRow key={entry.id} ref={flip(entry.id)} className={cn("relative bg-card", leader && leaderRow)}>
              <TableCell className="pl-4">
                <PlaceBadge place={ranked ? place : null} />
              </TableCell>
              <TableCell className="font-semibold tabular-nums">{entry.bibNumber}</TableCell>
              <AthleteCell entry={entry} leader={leader} />
              {stations.map(({ stationNumber }) => {
                const reps = perStation.get(stationNumber) ?? null;
                return (
                  <TableCell key={stationNumber} className="text-center tabular-nums">
                    {editable ? (
                      <CommitNumberInput
                        aria-label={`Reps for Nr ${entry.bibNumber} at station ${stationNumber}`}
                        className="mx-auto w-16"
                        value={reps}
                        min={0}
                        max={MAX_REPS}
                        allowEmpty
                        onCommit={(value) => setScore.mutateAsync({ entryId: entry.id, setId: stationSet.id, stationNumber, reps: value })}
                      />
                    ) : (
                      (reps ?? "—")
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="pr-4 text-right text-base font-semibold tabular-nums">{totalReps}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
