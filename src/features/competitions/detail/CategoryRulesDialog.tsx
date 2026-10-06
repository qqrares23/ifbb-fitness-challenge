import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import type { Category } from "@/db/categories";
import { AgeRulesFields, rulesToForm } from "@/features/categories/AgeRulesFields";
import { validateSubgroup } from "@/features/categories/validateSubgroup";
import { useFormState } from "@/hooks/useFormState";
import { useCategoryMutations } from "../useCompetitions";

interface CategoryRulesDialogProps {
  /** null = closed. */
  category: Category | null;
  onClose: () => void;
}

/** Edits one competition category's sex and age rules (its library copy is not touched). */
export function CategoryRulesDialog({ category, onClose }: CategoryRulesDialogProps) {
  return (
    <FormDialog title={`Edit "${category?.name ?? ""}"`} open={category !== null} onOpenChange={(open) => !open && onClose()} formKey={category?.id ?? "closed"}>
      {category && <CategoryRulesForm category={category} onDone={onClose} />}
    </FormDialog>
  );
}

function CategoryRulesForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const { updateRules } = useCategoryMutations();
  const { values, set, submitted, onSubmit } = useFormState(() => rulesToForm(category));
  const validation = validateSubgroup(values);
  const errors = submitted && !validation.ok ? validation.errors : {};

  const handleSubmit = onSubmit(() => {
    if (validation.ok) void saveAndClose(() => updateRules.mutateAsync({ category, rules: validation.value }), onDone);
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <AgeRulesFields values={values} errors={errors} set={set} />
      <p className="text-xs text-muted-foreground">
        Only this competition changes; the category library keeps its rules. Athletes who no longer fit are flagged in red.
      </p>
      <FormActions onCancel={onDone} submitLabel="Save changes" saving={updateRules.isPending} />
    </form>
  );
}
