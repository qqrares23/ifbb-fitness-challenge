import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Category } from "@/db/categories";
import type { CategoryGender } from "@/engine";
import { CATEGORY_GENDER_LABELS } from "@/lib/labels";
import { useCategoryMutations } from "../useCompetitions";
import { validateCategory, type CategoryFormValues } from "./validateCategory";

interface CategoryFormDialogProps {
  competitionId: number;
  /** null = create a new category. */
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryFormDialog({ competitionId, category, open, onOpenChange }: CategoryFormDialogProps) {
  return (
    <FormDialog title={category ? "Edit category" : "Add category"} open={open} onOpenChange={onOpenChange} formKey={category?.id ?? "new"}>
      <CategoryForm competitionId={competitionId} category={category} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function toForm(category: Category | null): CategoryFormValues {
  return {
    name: category?.name ?? "",
    gender: category?.gender ?? "mixed",
    minAge: category?.minAge?.toString() ?? "",
    maxAge: category?.maxAge?.toString() ?? "",
  };
}

function CategoryForm({ competitionId, category, onDone }: { competitionId: number; category: Category | null; onDone: () => void }) {
  const { create, update } = useCategoryMutations();
  const [values, setValues] = useState(() => toForm(category));
  const [submitted, setSubmitted] = useState(false);
  const validation = validateCategory(values);
  const errors = submitted && !validation.ok ? validation.errors : {};

  const set = (key: keyof CategoryFormValues, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.ok) return;
    const value = validation.value;
    void saveAndClose(
      () => (category ? update.mutateAsync({ ...value, id: category.id }) : create.mutateAsync({ ...value, competitionId })),
      onDone,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="category-name" label="Name" error={errors.name}>
        <Input id="category-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Juniors Men 16–20" autoFocus />
      </FormField>
      <FormField id="category-gender" label="Gender">
        <Select value={values.gender} onValueChange={(gender) => set("gender", gender as CategoryGender)}>
          <SelectTrigger id="category-gender" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_GENDER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="category-min-age" label="Minimum age" error={errors.minAge}>
          <Input id="category-min-age" inputMode="numeric" value={values.minAge} onChange={(e) => set("minAge", e.target.value)} placeholder="No limit" />
        </FormField>
        <FormField id="category-max-age" label="Maximum age" error={errors.maxAge}>
          <Input id="category-max-age" inputMode="numeric" value={values.maxAge} onChange={(e) => set("maxAge", e.target.value)} placeholder="No limit" />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Both limits are inclusive and use the athlete's age on the competition date.</p>
      <FormActions onCancel={onDone} submitLabel={category ? "Save changes" : "Add category"} saving={create.isPending || update.isPending} />
    </form>
  );
}
