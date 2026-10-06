import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Competition, CompetitionKind, NewCompetitionInput } from "@/db/competitions";
import { useFormState } from "@/hooks/useFormState";
import { todayIso } from "@/lib/dates";
import { COMPETITION_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useIconAnimation } from "@/components/icons/animated";
import { ANIMATED_KIND_ICONS } from "./CompetitionBadges";
import { useCompetitionMutations } from "./useCompetitions";

const KIND_DESCRIPTIONS: Record<CompetitionKind, string> = {
  fitness_challenge: "Reps at each station. Most total reps wins.",
  speed_fit: "One time for the whole set of exercises. Fastest wins.",
};

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
  const { values, set, submitted, onSubmit } = useFormState<NewCompetitionInput>(
    competition ?? { name: "", date: todayIso(), location: "", kind: "fitness_challenge" },
  );
  const errors = {
    name: submitted && !values.name.trim() ? "Name is required." : undefined,
    date: submitted && !values.date ? "Date is required." : undefined,
  };

  const handleSubmit = onSubmit(() => {
    if (!values.name.trim() || !values.date) return;
    void saveAndClose(async () => {
      if (competition) return update.mutateAsync({ ...values, id: competition.id });
      const id = await create.mutateAsync(values);
      navigate(`/competitions/${id}`);
    }, onDone);
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {/* The challenge type decides the whole data shape, so it can only be picked at creation. */}
      {!competition && (
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-1.5 text-sm font-medium">Challenge</legend>
          {(Object.keys(COMPETITION_KIND_LABELS) as CompetitionKind[]).map((kind) => (
            <KindOption key={kind} kind={kind} selected={values.kind === kind} onSelect={() => set("kind", kind)} />
          ))}
        </fieldset>
      )}
      <FormField id="competition-name" label="Name" error={errors.name}>
        <Input id="competition-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. IFBB World Cup" autoFocus />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="competition-date" label="Date" error={errors.date}>
          <Input id="competition-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
        </FormField>
        <FormField id="competition-location" label="Location (optional)">
          <Input id="competition-location" value={values.location} onChange={(e) => set("location", e.target.value)} />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Athlete ages for categories are counted as this date's year minus the year of birth.</p>
      <FormActions onCancel={onDone} submitLabel={competition ? "Save changes" : "Create competition"} saving={create.isPending || update.isPending} />
    </form>
  );
}

function KindOption({ kind, selected, onSelect }: { kind: CompetitionKind; selected: boolean; onSelect: () => void }) {
  const Icon = ANIMATED_KIND_ICONS[kind];
  const { ref, triggers } = useIconAnimation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      {...triggers}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card",
      )}
    >
      <Icon ref={ref} size={22} className={selected ? "text-primary" : "text-muted-foreground"} />
      <span className="font-medium">{COMPETITION_KIND_LABELS[kind]}</span>
      <span className="text-xs text-muted-foreground">{KIND_DESCRIPTIONS[kind]}</span>
    </button>
  );
}
