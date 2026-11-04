import { useState } from "react";
import { Link } from "react-router";
import { Tags } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayersIcon } from "@/components/icons/layers";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { RowActions } from "@/components/shared/RowActions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { CATEGORY_GENDER_LABELS, formatAgeRange } from "@/lib/labels";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CompetitionPermissions } from "../permissions";
import { CompetitionKindBadge } from "../CompetitionBadges";
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
  const { categories, entries, stationSets } = setup;
  const { remove, setUsesStationSet } = useCategoryMutations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const editable = permissions.editSetup;
  // The station sets column is for Fitness Challenge categories; Speed Fit ones are timed instead.
  const fitnessChallenge = categories.some((c) => c.kind === "fitness_challenge");

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
                  {fitnessChallenge && <TableHead className="w-52">Station sets</TableHead>}
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
                    {fitnessChallenge && category.kind === "speed_fit" && (
                      <TableCell>
                        <CompetitionKindBadge kind="speed_fit" />
                      </TableCell>
                    )}
                    {fitnessChallenge && category.kind === "fitness_challenge" && (
                      <TableCell>
                        {/* One chip per set; a category can use several (each ranked, plus overall). */}
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Station sets for ${category.name}`}>
                          {stationSets.map((set) => {
                            const used = category.stationSetIds.includes(set.id);
                            return editable ? (
                              <button
                                key={set.id}
                                type="button"
                                aria-pressed={used}
                                title={`${set.stations.length} stations`}
                                onClick={() => setUsesStationSet.mutate({ categoryId: category.id, setId: set.id, used: !used })}
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                                  used ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {set.name}
                              </button>
                            ) : (
                              used && (
                                <span key={set.id} className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                                  {set.name}
                                </span>
                              )
                            );
                          })}
                          {!editable && category.stationSetIds.length === 0 && "—"}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{categoryEntries(category.id).length}</TableCell>
                    {editable && (
                      <TableCell className="pr-4">
                        <RowActions noun="category" onEdit={() => setEditing(category)} onDelete={() => setRemoving(category)} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {fitnessChallenge && editable && stationSets.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Click a set to add it to or remove it from a category. A category with several sets is ranked per set and overall. Removing a set
              keeps the reps recorded on it; they come back if you add it again.
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
