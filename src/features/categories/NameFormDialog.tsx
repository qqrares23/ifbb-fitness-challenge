import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

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

/** A one-field dialog, for naming an age group or a level. */
export function NameFormDialog({ title, open, onOpenChange, ...props }: NameFormDialogProps) {
  return (
    <FormDialog title={title} open={open} onOpenChange={onOpenChange} formKey={`${open}${props.initial}`}>
      <NameForm {...props} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

type NameFormProps = Omit<NameFormDialogProps, "title" | "open" | "onOpenChange"> & { onDone: () => void };

function NameForm({ label, placeholder, submitLabel, initial, onSave, saving, onDone }: NameFormProps) {
  const [name, setName] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const error = submitted && !name.trim() ? "Name is required." : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (name.trim()) void saveAndClose(() => onSave(name), onDone);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="library-name" label={label} error={error}>
        <Input id="library-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} autoFocus />
      </FormField>
      <FormActions onCancel={onDone} submitLabel={submitLabel} saving={saving} />
    </form>
  );
}
