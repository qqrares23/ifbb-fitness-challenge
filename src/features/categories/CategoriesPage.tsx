import { Tags } from "lucide-react";
import { LibraryPage } from "@/components/shared/LibraryPage";
import type { CategoryPreset } from "@/db/categoryPresets";
import { CATEGORY_GENDER_LABELS, formatAgeRange } from "@/lib/labels";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { useCategoryPresetMutations, useCategoryPresets } from "./useCategoryPresets";

export function CategoriesPage() {
  const { remove } = useCategoryPresetMutations();

  return (
    <LibraryPage<CategoryPreset>
      title="Categories"
      description="The category library competitions pick from. Each category is ranked separately."
      noun="category"
      emptyIcon={Tags}
      emptyDescription="Create categories by gender and age once, then add them to any competition."
      query={useCategoryPresets()}
      columns={[
        { header: "Category", cell: (c) => c.name },
        { header: "Gender", cell: (c) => CATEGORY_GENDER_LABELS[c.gender] },
        { header: "Age", cell: (c) => formatAgeRange(c) },
      ]}
      searchPlaceholder="Search categories…"
      searchFields={(c) => [c.name, CATEGORY_GENDER_LABELS[c.gender]]}
      itemName={(c) => c.name}
      deleteNote="Competitions that already use it keep their copy."
      onDelete={(preset) => remove.mutate(preset)}
      renderForm={({ item, open, onOpenChange }) => <CategoryFormDialog category={item} open={open} onOpenChange={onOpenChange} />}
    />
  );
}
