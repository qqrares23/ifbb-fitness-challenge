import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import type { CompetitionSetup } from "@/db/competitions";
import { MAX_STATIONS } from "@/db/stations";
import { useExercises } from "@/features/exercises/useExercises";
import { useStationMutations } from "../useCompetitions";

interface StationsPanelProps {
  setup: CompetitionSetup;
  locked: boolean;
}

export function StationsPanel({ setup, locked }: StationsPanelProps) {
  const { competition, stations } = setup;
  const exercises = useExercises().data ?? [];
  const { setCount, setExercise } = useStationMutations();
  const [count, setCountText] = useState(String(stations.length));
  const parsedCount = Number(count);
  const countValid = count.trim() !== "" && Number.isInteger(parsedCount) && parsedCount >= 0 && parsedCount <= MAX_STATIONS;

  function applyCount(event: FormEvent) {
    event.preventDefault();
    if (countValid) setCount.mutate({ competitionId: competition.id, count: parsedCount });
  }

  return (
    <div className="grid gap-6">
      {!locked && (
        <form onSubmit={applyCount} className="flex items-end gap-3">
          <FormField id="station-count" label="Number of stations" className="w-48">
            <Input id="station-count" type="number" min={0} max={MAX_STATIONS} value={count} onChange={(e) => setCountText(e.target.value)} />
          </FormField>
          <Button type="submit" variant="outline" disabled={!countValid || parsedCount === stations.length || setCount.isPending}>
            Apply
          </Button>
          <p className="pb-2 text-xs text-muted-foreground">Every athlete performs every station. Up to {MAX_STATIONS}.</p>
        </form>
      )}

      {!locked && exercises.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The exercise library is empty. <Link to="/exercises" className="font-medium text-foreground underline">Add exercises</Link> to assign them to stations.
        </p>
      )}

      {stations.length > 0 && (
        <ol className="grid gap-2 sm:grid-cols-2">
          {stations.map((station) => (
            <li key={station.stationNumber} className="flex items-center gap-3 surface p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold tabular-nums">
                {station.stationNumber}
              </span>
              {locked ? (
                <span className="font-medium">{station.exerciseName}</span>
              ) : (
                <Select
                  value={station.exerciseId?.toString() ?? ""}
                  onValueChange={(value) =>
                    setExercise.mutate({ competitionId: competition.id, stationNumber: station.stationNumber, exerciseId: Number(value) })
                  }
                >
                  <SelectTrigger className="w-full" aria-label={`Exercise for station ${station.stationNumber}`}>
                    <SelectValue placeholder="Choose an exercise…" />
                  </SelectTrigger>
                  <SelectContent>
                    {exercises.map((exercise) => (
                      <SelectItem key={exercise.id} value={exercise.id.toString()}>
                        {exercise.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
