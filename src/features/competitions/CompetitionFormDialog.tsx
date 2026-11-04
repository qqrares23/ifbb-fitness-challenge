import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Competition, CompetitionInput } from "@/db/competitions";
import { useFormState } from "@/hooks/useFormState";
import { todayIso } from "@/lib/dates";
import { competitionPermissions } from "./permissions";
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
  const { values, set, submitted, onSubmit } = useFormState<CompetitionInput>(
    competition ?? { name: "", date: todayIso(), endDate: null, location: "" },
  );
  const errors = {
    name: submitted && !values.name.trim() ? "Name is required." : undefined,
    date: submitted && !values.date ? "Start date is required." : undefined,
    // ISO dates compare as text.
    endDate: submitted && values.date && values.endDate && values.endDate < values.date ? "Can't be before the start date." : undefined,
  };
  // Once started only the location is locked (the database enforces this, see 0017); the name and both dates can be corrected.
  const started = competition !== null && !competitionPermissions(competition.status).editLocation;

  const handleSubmit = onSubmit(() => {
    if (!values.name.trim() || !values.date || (values.endDate && values.endDate < values.date)) return;
    void saveAndClose(async () => {
      if (competition) return update.mutateAsync({ ...values, id: competition.id });
      const id = await create.mutateAsync(values);
      navigate(`/competitions/${id}`);
    }, onDone);
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField id="competition-name" label="Name" error={errors.name}>
        <Input id="competition-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. IFBB World Cup" autoFocus />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="competition-date" label="Start date" error={errors.date}>
          <Input id="competition-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
        </FormField>
        <FormField id="competition-end-date" label="End date (optional)" error={errors.endDate}>
          <Input id="competition-end-date" type="date" min={values.date} value={values.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
        </FormField>
      </div>
      <FormField id="competition-location" label="Location (optional)">
        <Input id="competition-location" disabled={started} value={values.location} onChange={(e) => set("location", e.target.value)} />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Athlete ages for categories are counted as the start date's year minus the year of birth. Leave the end date empty for a one-day competition.
        {started && " The competition has started, so its location is locked; changing the start date's year can move athletes out of their categories' age rules."}
      </p>
      <FormActions onCancel={onDone} submitLabel={competition ? "Save changes" : "Create competition"} saving={create.isPending || update.isPending} />
    </form>
  );
}
