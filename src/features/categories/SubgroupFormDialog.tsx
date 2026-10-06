import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import type { AgeGroup, AgeSubgroup } from "@/db/categoryLibrary";
import { useFormState } from "@/hooks/useFormState";
import { AgeRulesFields, rulesToForm } from "./AgeRulesFields";
import { useCategoryLibraryMutations } from "./useCategoryLibrary";
import { validateSubgroup } from "./validateSubgroup";

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

function SubgroupForm({ ageGroup, subgroup, onDone }: { ageGroup: AgeGroup; subgroup: AgeSubgroup | null; onDone: () => void }) {
  const { createSubgroup, updateSubgroup } = useCategoryLibraryMutations();
  const { values, set, submitted, onSubmit } = useFormState(() => rulesToForm(subgroup));
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
      <AgeRulesFields values={values} errors={errors} set={set} />
      <FormActions
        onCancel={onDone}
        submitLabel={subgroup ? "Save changes" : "Add sub-group"}
        saving={createSubgroup.isPending || updateSubgroup.isPending}
      />
    </form>
  );
}
