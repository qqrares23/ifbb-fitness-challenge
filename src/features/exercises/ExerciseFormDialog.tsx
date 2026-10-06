import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Exercise, ExerciseInput } from "@/db/exercises";
import { useFormState } from "@/hooks/useFormState";
import { errorMessage } from "@/lib/errors";
import { loadPhoto } from "@/lib/images";
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
  const { values, set, submitted, onSubmit } = useFormState<ExerciseInput>(exercise ?? { name: "", photo: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const nameError = submitted && !values.name.trim() ? "Name is required." : undefined;

  const handleSubmit = onSubmit(() => {
    if (!values.name.trim()) return;
    void saveAndClose(
      () => (exercise ? update.mutateAsync({ ...values, id: exercise.id }) : create.mutateAsync(values)),
      onDone,
    );
  });

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      set("photo", await loadPhoto(file));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="exercise-name" label="Name" error={nameError}>
        <Input id="exercise-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Push-ups" autoFocus />
      </FormField>
      <FormField id="exercise-photo" label="Photo (optional)">
        <div className="flex items-center gap-3">
          {values.photo ? (
            <img src={values.photo} alt="" className="size-24 rounded-lg border object-cover" />
          ) : (
            <span className="flex size-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <ImagePlus className="size-6" />
            </span>
          )}
          <div className="grid gap-2">
            <Button id="exercise-photo" type="button" variant="outline" onClick={() => fileInput.current?.click()}>
              {values.photo ? "Change photo" : "Choose photo"}
            </Button>
            {values.photo && (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => set("photo", null)}>
                <X /> Remove
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Shown to judges on the scoring screen.</p>
      </FormField>
      <FormActions onCancel={onDone} submitLabel={exercise ? "Save changes" : "Add exercise"} saving={create.isPending || update.isPending} />
    </form>
  );
}
