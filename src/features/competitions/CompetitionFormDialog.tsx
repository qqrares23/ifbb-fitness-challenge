import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Competition, CompetitionInput } from "@/db/competitions";
import { todayIso } from "@/lib/dates";
import { useCompetitionMutations } from "./useCompetitions";

interface CompetitionFormDialogProps {
  /** null = create a new competition (and open it afterwards). */
  competition: Competition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompetitionFormDialog({ competition, open, onOpenChange }: CompetitionFormDialogProps) {
  return (
    <FormDialog
      title={competition ? "Edit competition" : "New competition"}
      open={open}
      onOpenChange={onOpenChange}
      formKey={competition?.id ?? "new"}
    >
      <CompetitionForm competition={competition} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function CompetitionForm({ competition, onDone }: { competition: Competition | null; onDone: () => void }) {
  const navigate = useNavigate();
  const { create, update } = useCompetitionMutations();
  const [values, setValues] = useState<CompetitionInput>(competition ?? { name: "", date: todayIso(), location: "" });
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    name: submitted && !values.name.trim() ? "Name is required." : undefined,
    date: submitted && !values.date ? "Date is required." : undefined,
  };

  const set = (key: keyof CompetitionInput, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!values.name.trim() || !values.date) return;
    void saveAndClose(async () => {
      if (competition) return update.mutateAsync({ ...values, id: competition.id });
      const id = await create.mutateAsync(values);
      navigate(`/competitions/${id}`);
    }, onDone);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="competition-name" label="Name" error={errors.name}>
        <Input id="competition-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. IFBB Fitness Challenge World Cup" autoFocus />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="competition-date" label="Date" error={errors.date}>
          <Input id="competition-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
        </FormField>
        <FormField id="competition-location" label="Location (optional)">
          <Input id="competition-location" value={values.location} onChange={(e) => set("location", e.target.value)} />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Athlete ages are checked against category limits on this date.</p>
      <FormActions onCancel={onDone} submitLabel={competition ? "Save changes" : "Create competition"} saving={create.isPending || update.isPending} />
    </form>
  );
}
