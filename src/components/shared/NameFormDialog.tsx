import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { useFormState } from "@/hooks/useFormState";

interface NameFormDialogProps {
  title: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  /** Name being edited; empty when adding. */
  initial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<unknown>;
  saving: boolean;
}

/** A one-field dialog, for naming something (an age group, a level, a station set). */
export function NameFormDialog({ title, open, onOpenChange, ...props }: NameFormDialogProps) {
  return (
    <FormDialog title={title} open={open} onOpenChange={onOpenChange} formKey={`${open}${props.initial}`}>
      <NameForm {...props} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

type NameFormProps = Omit<NameFormDialogProps, "title" | "open" | "onOpenChange"> & { onDone: () => void };

function NameForm({ label, placeholder, submitLabel, initial, onSave, saving, onDone }: NameFormProps) {
  const { values, set, submitted, onSubmit } = useFormState({ name: initial });
  const error = submitted && !values.name.trim() ? "Name is required." : undefined;

  const handleSubmit = onSubmit(() => {
    if (values.name.trim()) void saveAndClose(() => onSave(values.name), onDone);
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="library-name" label={label} error={error}>
        <Input id="library-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder={placeholder} autoFocus />
      </FormField>
      <FormActions onCancel={onDone} submitLabel={submitLabel} saving={saving} />
    </form>
  );
}
