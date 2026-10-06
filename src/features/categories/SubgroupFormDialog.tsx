import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { AgeGroup, AgeSubgroup } from "@/db/categoryLibrary";
import type { CategoryGender } from "@/engine";
import { useFormState } from "@/hooks/useFormState";
import { CATEGORY_GENDER_LABELS } from "@/lib/labels";
import { useCategoryLibraryMutations } from "./useCategoryLibrary";
import { validateSubgroup, type SubgroupFormValues } from "./validateSubgroup";

interface SubgroupFormDialogProps {
  ageGroup: AgeGroup;
  /** null = add a new sub-group to `ageGroup`. */
  subgroup: AgeSubgroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubgroupFormDialog({ ageGroup, subgroup, open, onOpenChange }: SubgroupFormDialogProps) {
  return (
    <FormDialog
      title={`${subgroup ? "Edit" : "Add"} ${ageGroup.name} sub-group`}
      open={open}
      onOpenChange={onOpenChange}
      formKey={`${open}${subgroup?.id ?? "new"}`}
    >
      <SubgroupForm ageGroup={ageGroup} subgroup={subgroup} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function toForm(subgroup: AgeSubgroup | null): SubgroupFormValues {
  return {
    gender: subgroup?.gender ?? "male",
    minAge: subgroup?.minAge?.toString() ?? "",
    maxAge: subgroup?.maxAge?.toString() ?? "",
  };
}

function SubgroupForm({ ageGroup, subgroup, onDone }: { ageGroup: AgeGroup; subgroup: AgeSubgroup | null; onDone: () => void }) {
  const { createSubgroup, updateSubgroup } = useCategoryLibraryMutations();
  const { values, set, submitted, onSubmit } = useFormState(() => toForm(subgroup));
  const validation = validateSubgroup(values);
  const errors = submitted && !validation.ok ? validation.errors : {};

  const handleSubmit = onSubmit(() => {
    if (!validation.ok) return;
    const rules = validation.value;
    void saveAndClose(
      () => (subgroup ? updateSubgroup.mutateAsync({ ...rules, id: subgroup.id }) : createSubgroup.mutateAsync({ ...rules, ageGroupId: ageGroup.id })),
      onDone,
    );
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="subgroup-gender" label="Sex">
        <Select value={values.gender} onValueChange={(gender) => set("gender", gender as CategoryGender)}>
          <SelectTrigger id="subgroup-gender" className="w-full">
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
        <FormField id="subgroup-min-age" label="Minimum age" error={errors.minAge}>
          <Input id="subgroup-min-age" inputMode="numeric" value={values.minAge} onChange={(e) => set("minAge", e.target.value)} placeholder="No limit" autoFocus />
        </FormField>
        <FormField id="subgroup-max-age" label="Maximum age" error={errors.maxAge}>
          <Input id="subgroup-max-age" inputMode="numeric" value={values.maxAge} onChange={(e) => set("maxAge", e.target.value)} placeholder="No limit" />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Both limits are inclusive. Age = the competition's year minus the year of birth.</p>
      <FormActions
        onCancel={onDone}
        submitLabel={subgroup ? "Save changes" : "Add sub-group"}
        saving={createSubgroup.isPending || updateSubgroup.isPending}
      />
    </form>
  );
}
