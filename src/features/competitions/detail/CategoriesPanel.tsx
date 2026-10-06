import { useState } from "react";
import { Link } from "react-router";
import { Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayersIcon } from "@/components/icons/layers";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { CATEGORY_GENDER_LABELS, formatAgeRange } from "@/lib/labels";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import type { CompetitionPermissions } from "../permissions";
import { useCategoryMutations } from "../useCompetitions";
import { AddCategoriesDialog } from "./AddCategoriesDialog";
import { CategoryRulesDialog } from "./CategoryRulesDialog";

interface CategoriesPanelProps {
  setup: CompetitionSetup;
  permissions: CompetitionPermissions;
  /** Entries that already have results: removing their category deletes those results. */
  entryIdsWithResults: ReadonlySet<number>;
}

export function CategoriesPanel({ setup, permissions, entryIdsWithResults }: CategoriesPanelProps) {
  const { competition, categories, entries, stationSets } = setup;
  const { remove, setStationSet } = useCategoryMutations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const editable = permissions.editSetup;
  const fitnessChallenge = competition.kind === "fitness_challenge";

  const categoryEntries = (categoryId: number) => entries.filter((e) => e.categoryId === categoryId);
  const removingEntries = removing ? categoryEntries(removing.id) : [];
  const removingHasResults = removingEntries.some((e) => entryIdsWithResults.has(e.id));

  const addButton = editable && (
    <AnimatedButton icon={LayersIcon} onClick={() => setAdding(true)}>
      Add from library
    </AnimatedButton>
  );

  return (
    <div className="grid gap-4">
      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Pick this competition's categories from the category library. Each is ranked separately."
          action={addButton}
        />
      ) : (
        <>
          {editable && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Categories come from the{" "}
                <Link to="/categories" className="font-medium text-foreground underline underline-offset-4">
                  category library
                </Link>
                ; this competition keeps its own copy, which can be changed until the competition is finished.
              </p>
              {addButton}
            </div>
          )}
          <div className="overflow-hidden surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Category</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  {fitnessChallenge && <TableHead className="w-44">Station set</TableHead>}
                  <TableHead className="text-right">Athletes</TableHead>
                  {editable && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category, index) => (
                  <TableRow key={category.id} className={ROW_ENTER} style={staggerStyle(index)}>
                    <TableCell className="pl-4 font-medium">{category.name}</TableCell>
                    <TableCell>{CATEGORY_GENDER_LABELS[category.gender]}</TableCell>
                    <TableCell>{formatAgeRange(category)}</TableCell>
                    {fitnessChallenge && (
                      <TableCell>
                        {editable ? (
                          // Switching keeps the reps recorded on the old set; they come back if switched back.
                          <Select
                            value={category.stationSetId?.toString() ?? ""}
                            onValueChange={(value) => setStationSet.mutate({ categoryId: category.id, stationSetId: Number(value) })}
                          >
                            <SelectTrigger className="w-full" aria-label={`Station set for ${category.name}`}>
                              <SelectValue placeholder="Pick a set…" />
                            </SelectTrigger>
                            <SelectContent>
                              {stationSets.map((set) => (
                                <SelectItem key={set.id} value={set.id.toString()}>
                                  {set.name} <span className="text-muted-foreground">· {set.stations.length} stations</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          (stationSets.find((s) => s.id === category.stationSetId)?.name ?? "—")
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{categoryEntries(category.id).length}</TableCell>
                    {editable && (
                      <TableCell className="pr-4">
                        <div className="flex justify-end">
                          <AnimatedButton icon={SquarePenIcon} variant="ghost" size="icon" aria-label={`Edit ${category.name}`} onClick={() => setEditing(category)} />
                          <Button variant="ghost" size="icon" aria-label={`Remove ${category.name}`} onClick={() => setRemoving(category)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {fitnessChallenge && editable && competition.status === "running" && (
            <p className="text-xs text-muted-foreground">
              Switching a category to another station set keeps the reps recorded on the old one; they come back if you switch back.
            </p>
          )}
        </>
      )}

      <AddCategoriesDialog setup={setup} open={adding} onOpenChange={setAdding} />
      <CategoryRulesDialog category={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove category?"
        description={
          `"${removing?.name}"` +
          (removingEntries.length > 0
            ? ` and its ${removingEntries.length} entered athlete${removingEntries.length === 1 ? "" : "s"}${removingHasResults ? ", with their results," : ""}`
            : "") +
          " will be removed from this competition. The library keeps the category."
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}
