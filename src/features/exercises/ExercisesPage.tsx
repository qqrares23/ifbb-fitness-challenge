import { useMemo, useState } from "react";
import { Dumbbell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import { RowActions } from "@/components/shared/RowActions";
import { SearchInput } from "@/components/shared/SearchInput";
import type { Exercise } from "@/db/exercises";
import { filterBySearch } from "@/lib/search";
import { ExerciseFormDialog } from "./ExerciseFormDialog";
import { useExerciseMutations, useExercises } from "./useExercises";

export function ExercisesPage() {
  const exercisesQuery = useExercises();
  const { remove } = useExerciseMutations();
  const [search, setSearch] = useState("");
  /** undefined = closed, null = adding a new exercise. */
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Exercise | null>(null);

  const filtered = useMemo(
    () => filterBySearch(exercisesQuery.data ?? [], search, (e) => [e.name, e.description]),
    [exercisesQuery.data, search],
  );

  const addButton = (
    <Button onClick={() => setEditing(null)}>
      <Plus /> Add exercise
    </Button>
  );

  return (
    <>
      <PageHeader title="Exercises" description="The exercise library stations are built from." actions={addButton} />

      <QueryState query={exercisesQuery}>
        {(exercises) =>
          exercises.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No exercises yet" description="Add the exercises athletes will perform at the stations." action={addButton} />
          ) : (
            <div className="grid gap-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search exercises…" />
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No exercise matches "{search}".</p>
              ) : (
                <div className="rounded-xl border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-64 pl-4">Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((exercise) => (
                        <TableRow key={exercise.id}>
                          <TableCell className="pl-4 align-top font-medium">{exercise.name}</TableCell>
                          <TableCell className="whitespace-pre-wrap text-muted-foreground">{exercise.description || "—"}</TableCell>
                          <TableCell className="pr-4 align-top">
                            <RowActions noun="exercise" onEdit={() => setEditing(exercise)} onDelete={() => setDeleting(exercise)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )
        }
      </QueryState>

      <ExerciseFormDialog
        exercise={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete exercise?"
        description={deleting ? `"${deleting.name}" will be removed from the library.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
