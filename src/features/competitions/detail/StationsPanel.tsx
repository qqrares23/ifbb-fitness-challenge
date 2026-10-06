import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Dumbbell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusIcon } from "@/components/icons/plus";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { NameFormDialog } from "@/components/shared/NameFormDialog";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Exercise } from "@/db/exercises";
import { MAX_STATIONS, type StationSet } from "@/db/stations";
import { useExercises } from "@/features/exercises/useExercises";
import { useStationMutations } from "../useCompetitions";

interface StationsPanelProps {
  setup: CompetitionSetup;
  /** Finished: nothing can change. */
  locked: boolean;
  /** Running or finished: removing stations would delete recorded reps, so it asks first. */
  started: boolean;
}

/** The competition's station sets. Each category is scored on one of them (picked in Categories). */
export function StationsPanel({ setup, locked, started }: StationsPanelProps) {
  const { competition, stationSets, categories } = setup;
  const exercises = useExercises().data ?? [];
  const { createSet } = useStationMutations();

  const addButton = !locked && (
    <AnimatedButton icon={PlusIcon} variant="outline" disabled={createSet.isPending} onClick={() => createSet.mutate({ competitionId: competition.id })}>
      Add station set
    </AnimatedButton>
  );

  return (
    <div className="grid gap-6">
      {!locked && exercises.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The exercise library is empty. <Link to="/exercises" className="font-medium text-foreground underline">Add exercises</Link> to assign them to stations.
        </p>
      )}

      {stationSets.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No station sets" description="Add a set of stations; every athlete of a category performs every station of its set." action={addButton} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Every athlete performs every station of their category's set. Pick each category's set in the Categories tab.
              {started && !locked && " Changing an exercise keeps the reps already recorded at that station."}
            </p>
            {addButton}
          </div>
          {stationSets.map((set) => (
            // Keyed by the station count so the count field resets to the saved value after a change.
            <StationSetCard
              key={`${set.id}-${set.stations.length}`}
              set={set}
              usedBy={categories.filter((c) => c.stationSetId === set.id)}
              exercises={exercises}
              locked={locked}
              started={started}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface StationSetCardProps {
  set: StationSet;
  usedBy: Category[];
  exercises: Exercise[];
  locked: boolean;
  started: boolean;
}

function StationSetCard({ set, usedBy, exercises, locked, started }: StationSetCardProps) {
  const { setCount, setExercise, renameSet, deleteSet } = useStationMutations();
  const [count, setCountText] = useState(String(set.stations.length));
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState<"shrink" | "delete" | null>(null);
  const parsedCount = Number(count);
  const countValid = count.trim() !== "" && Number.isInteger(parsedCount) && parsedCount >= 0 && parsedCount <= MAX_STATIONS;

  function applyCount(event: FormEvent) {
    event.preventDefault();
    if (!countValid) return;
    if (started && parsedCount < set.stations.length) setConfirming("shrink");
    else setCount.mutate({ setId: set.id, count: parsedCount });
  }

  return (
    <section className="surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">{set.name}</h3>
          <p className="text-xs text-muted-foreground">
            {usedBy.length === 0 ? "Not used by any category yet." : `Used by ${usedBy.map((c) => c.name).join(", ")}.`}
          </p>
        </div>
        {!locked && (
          <div className="flex items-center gap-1">
            <AnimatedButton icon={SquarePenIcon} variant="ghost" size="icon" aria-label={`Rename ${set.name}`} onClick={() => setRenaming(true)} />
            <Button variant="ghost" size="icon" aria-label={`Delete ${set.name}`} onClick={() => setConfirming("delete")}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 p-4">
        {!locked && (
          <form onSubmit={applyCount} className="flex items-end gap-3">
            <FormField id={`station-count-${set.id}`} label="Number of stations" className="w-48">
              <Input id={`station-count-${set.id}`} type="number" min={0} max={MAX_STATIONS} value={count} onChange={(e) => setCountText(e.target.value)} />
            </FormField>
            <Button type="submit" variant="outline" disabled={!countValid || parsedCount === set.stations.length || setCount.isPending}>
              Apply
            </Button>
            <p className="pb-2 text-xs text-muted-foreground">Up to {MAX_STATIONS}.</p>
          </form>
        )}

        {set.stations.length > 0 && (
          <ol className="grid gap-2 sm:grid-cols-2">
            {set.stations.map((station) => (
              <li key={station.stationNumber} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold tabular-nums">{station.stationNumber}</span>
                {locked ? (
                  <span className="font-medium">{station.exerciseName ?? "—"}</span>
                ) : (
                  <Select
                    value={station.exerciseId?.toString() ?? ""}
                    onValueChange={(value) => setExercise.mutate({ setId: set.id, stationNumber: station.stationNumber, exerciseId: Number(value) })}
                  >
                    <SelectTrigger className="w-full" aria-label={`Exercise for ${set.name} station ${station.stationNumber}`}>
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

      <NameFormDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename station set"
        label="Name"
        placeholder="e.g. Set A, Morning, Final"
        submitLabel="Save changes"
        initial={set.name}
        saving={renameSet.isPending}
        onSave={(name) => renameSet.mutateAsync({ id: set.id, name })}
      />
      <ConfirmDialog
        open={confirming === "shrink"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Remove stations?"
        description={`${set.name} station${set.stations.length - parsedCount > 1 ? `s ${parsedCount + 1}–${set.stations.length}` : ` ${set.stations.length}`} will be removed, together with any reps recorded there.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => setCount.mutate({ setId: set.id, count: parsedCount })}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Delete ${set.name}?`}
        description={
          `${set.name} and its stations will be deleted${started ? ", together with any reps recorded on them" : ""}.` +
          (usedBy.length > 0 ? ` ${usedBy.length} categor${usedBy.length === 1 ? "y uses" : "ies use"} it and will need another set.` : "")
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteSet.mutate(set.id)}
      />
    </section>
  );
}
