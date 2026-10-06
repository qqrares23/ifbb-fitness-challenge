import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryCombobox } from "@/components/shared/CountryCombobox";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import type { Athlete, AthleteInput } from "@/db/athletes";
import type { Sex } from "@/engine";
import { useFormState } from "@/hooks/useFormState";
import { todayIso } from "@/lib/dates";
import { SEX_LABELS } from "@/lib/labels";
import { useAthleteMutations } from "./useAthletes";
import { validateAthlete } from "./validateAthlete";

const EMPTY: AthleteInput = { firstName: "", lastName: "", dateOfBirth: "", sex: "male", country: "" };

interface AthleteFormDialogProps {
  /** null = create a new athlete. */
  athlete: Athlete | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AthleteFormDialog({ athlete, open, onOpenChange }: AthleteFormDialogProps) {
  return (
    <FormDialog title={athlete ? "Edit athlete" : "Add athlete"} open={open} onOpenChange={onOpenChange} formKey={athlete?.id ?? "new"}>
      <AthleteForm athlete={athlete} onDone={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function AthleteForm({ athlete, onDone }: { athlete: Athlete | null; onDone: () => void }) {
  const { create, update } = useAthleteMutations();
  const { values, set, submitted, onSubmit } = useFormState<AthleteInput>(athlete ?? EMPTY);
  const today = todayIso();
  const errors = submitted ? validateAthlete(values, today) : {};

  const handleSubmit = onSubmit(() => {
    if (Object.keys(validateAthlete(values, today)).length > 0) return;
    void saveAndClose(
      () => (athlete ? update.mutateAsync({ ...values, id: athlete.id }) : create.mutateAsync(values)),
      onDone,
    );
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="athlete-first-name" label="Name" error={errors.firstName}>
          <Input id="athlete-first-name" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus />
        </FormField>
        <FormField id="athlete-last-name" label="Surname" error={errors.lastName}>
          <Input id="athlete-last-name" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </FormField>
        <FormField id="athlete-dob" label="Date of birth" error={errors.dateOfBirth}>
          <Input id="athlete-dob" type="date" max={today} value={values.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </FormField>
        <FormField id="athlete-sex" label="Sex">
          <Select value={values.sex} onValueChange={(sex) => set("sex", sex as Sex)}>
            <SelectTrigger id="athlete-sex" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEX_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField id="athlete-country" label="Country" error={errors.country}>
        <CountryCombobox id="athlete-country" value={values.country} onChange={(code) => set("country", code)} />
      </FormField>
      <FormActions onCancel={onDone} submitLabel={athlete ? "Save changes" : "Add athlete"} saving={create.isPending || update.isPending} />
    </form>
  );
}
