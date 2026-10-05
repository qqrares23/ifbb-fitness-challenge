import { useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { CATEGORY_GENDER_LABELS, formatAgeRange } from "@/lib/labels";
import { useCategoryMutations } from "../useCompetitions";
import { CategoryFormDialog } from "./CategoryFormDialog";

interface CategoriesPanelProps {
  setup: CompetitionSetup;
  locked: boolean;
}

export function CategoriesPanel({ setup, locked }: CategoriesPanelProps) {
  const { competition, categories, entries } = setup;
  const { remove } = useCategoryMutations();
  /** undefined = closed, null = adding a new category. */
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const entryCount = (categoryId: number) => entries.filter((e) => e.categoryId === categoryId).length;
  const deletingCount = deleting ? entryCount(deleting.id) : 0;

  const addButton = !locked && (
    <Button onClick={() => setEditing(null)}>
      <Plus /> Add category
    </Button>
  );

  return (
    <div className="grid gap-4">
      {categories.length === 0 ? (
        <EmptyState icon={Tags} title="No categories yet" description="Categories group athletes by gender and age. Each is ranked separately." action={addButton} />
      ) : (
        <>
          <div className="flex justify-end">{addButton}</div>
          <div className="surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Category</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Athletes</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="pl-4 font-medium">{category.name}</TableCell>
                    <TableCell>{CATEGORY_GENDER_LABELS[category.gender]}</TableCell>
                    <TableCell>{formatAgeRange(category)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entryCount(category.id)}</TableCell>
                    <TableCell className="pr-4">
                      {!locked && <RowActions noun="category" onEdit={() => setEditing(category)} onDelete={() => setDeleting(category)} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <CategoryFormDialog
        competitionId={competition.id}
        category={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete category?"
        description={
          deletingCount > 0
            ? `"${deleting?.name}" and its ${deletingCount} entered athlete${deletingCount === 1 ? "" : "s"} will be removed from this competition.`
            : `"${deleting?.name}" will be removed from this competition.`
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
