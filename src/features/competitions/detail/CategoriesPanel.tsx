import { useState } from "react";
import { Link } from "react-router";
import { Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayersIcon } from "@/components/icons/layers";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { CATEGORY_GENDER_LABELS, formatAgeRange } from "@/lib/labels";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import { canRemoveCategory, type CompetitionPermissions } from "../permissions";
import { useCategoryMutations } from "../useCompetitions";
import { AddCategoriesDialog } from "./AddCategoriesDialog";

interface CategoriesPanelProps {
  setup: CompetitionSetup;
  permissions: CompetitionPermissions;
}

export function CategoriesPanel({ setup, permissions }: CategoriesPanelProps) {
  const { categories, entries } = setup;
  const { remove } = useCategoryMutations();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Category | null>(null);

  const entryCount = (categoryId: number) => entries.filter((e) => e.categoryId === categoryId).length;
  const removingCount = removing ? entryCount(removing.id) : 0;

  const addButton = permissions.addCategories && (
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
          {permissions.addCategories && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Categories come from the{" "}
                <Link to="/categories" className="font-medium text-foreground underline underline-offset-4">
                  category library
                </Link>
                ; this competition keeps its own copy.
                {!permissions.editSetup && " Started: a category can still be added for a late athlete, and removed only while empty."}
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
                  <TableHead className="text-right">Athletes</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category, index) => (
                  <TableRow key={category.id} className={ROW_ENTER} style={staggerStyle(index)}>
                    <TableCell className="pl-4 font-medium">{category.name}</TableCell>
                    <TableCell>{CATEGORY_GENDER_LABELS[category.gender]}</TableCell>
                    <TableCell>{formatAgeRange(category)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entryCount(category.id)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {canRemoveCategory(permissions, entryCount(category.id)) && (
                        <Button variant="ghost" size="icon" aria-label="Remove category" onClick={() => setRemoving(category)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AddCategoriesDialog setup={setup} open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove category?"
        description={
          removingCount > 0
            ? `"${removing?.name}" and its ${removingCount} entered athlete${removingCount === 1 ? "" : "s"} will be removed from this competition. The library keeps the category.`
            : `"${removing?.name}" will be removed from this competition. The library keeps the category.`
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}
