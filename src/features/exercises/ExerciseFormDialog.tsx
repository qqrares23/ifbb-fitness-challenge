import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Exercise, ExerciseInput } from "@/db/exercises";
import { useFormState } from "@/hooks/useFormState";
import { useExerciseMutations } from "./useExercises";

interface ExerciseFormDialogProps {
  /** null = create a new exercise. */
  exercise: Exercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseFormDialog({ exercise, open, onOpenChange }: ExerciseFormDialogProps) {
  return (
    <FormDialog title={exercise ? "Edit exercise" : "Add exercise"} open={open} onOpenChange={onOpenChange} formKey={exercise?.id ?? "new"}>
      <ExerciseForm exercise={exercise} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function ExerciseForm({ exercise, onDone }: { exercise: Exercise | null; onDone: () => void }) {
  const { create, update } = useExerciseMutations();
  const { values, set, submitted, onSubmit } = useFormState<ExerciseInput>(exercise ?? { name: "", description: "" });
  const nameError = submitted && !values.name.trim() ? "Name is required." : undefined;

  const handleSubmit = onSubmit(() => {
    if (!values.name.trim()) return;
    void saveAndClose(
      () => (exercise ? update.mutateAsync({ ...values, id: exercise.id }) : create.mutateAsync(values)),
      onDone,
    );
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="exercise-name" label="Name" error={nameError}>
        <Input
          id="exercise-name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Push-ups"
          autoFocus
        />
      </FormField>
      <FormField id="exercise-description" label="Description (optional)">
        <Textarea
          id="exercise-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="How a repetition is counted, equipment, time limit…"
          rows={4}
        />
      </FormField>
      <FormActions onCancel={onDone} submitLabel={exercise ? "Save changes" : "Add exercise"} saving={create.isPending || update.isPending} />
    </form>
  );
}
