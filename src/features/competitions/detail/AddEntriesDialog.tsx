import { useMemo, useState, type FormEvent } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlusIcon } from "@/components/icons/user-plus";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { CheckList, toggleInSet } from "@/components/shared/CheckList";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { SearchInput } from "@/components/shared/SearchInput";
import type { CompetitionSetup } from "@/db/competitions";
import { ageOn, eligibilityProblems } from "@/engine";
import { AthleteFormDialog } from "@/features/athletes/AthleteFormDialog";
import { useAthletes } from "@/features/athletes/useAthletes";
import { countryName } from "@/lib/countries";
import { describeCategoryRules, SEX_LABELS } from "@/lib/labels";
import { filterBySearch } from "@/lib/search";
import { useEntryMutations } from "../useCompetitions";

interface AddEntriesDialogProps {
  setup: CompetitionSetup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category to start with, e.g. the one on screen when a late athlete is spotted. */
  initialCategoryId?: number;
}

export function AddEntriesDialog({ setup, open, onOpenChange, initialCategoryId }: AddEntriesDialogProps) {
  const late = setup.competition.status === "running";
  return (
    <FormDialog title={late ? "Enter late athlete" : "Enter athletes"} open={open} onOpenChange={onOpenChange} formKey={String(open)} wide>
      {open && <AddEntriesForm setup={setup} initialCategoryId={initialCategoryId} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

interface AddEntriesFormProps {
  setup: CompetitionSetup;
  initialCategoryId?: number;
  onDone: () => void;
}

function AddEntriesForm({ setup, initialCategoryId, onDone }: AddEntriesFormProps) {
  const { competition, categories, entries } = setup;
  const athletes = useAthletes().data ?? [];
  const { add } = useEntryMutations();
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? 0);
  const [creatingAthlete, setCreatingAthlete] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const category = categories.find((c) => c.id === categoryId);

  // An athlete can enter several categories (levels), but each one only once.
  const candidates = useMemo(() => {
    const entered = new Set(entries.filter((e) => e.categoryId === categoryId).map((e) => e.athleteId));
    return athletes
      .filter((a) => !entered.has(a.id))
      .map((athlete) => ({ athlete, problems: category ? eligibilityProblems(athlete, category, competition.date) : [] }))
      .sort((a, b) => a.problems.length - b.problems.length);
  }, [athletes, entries, categoryId, category, competition.date]);

  const visible = filterBySearch(candidates, search, ({ athlete }) => [athlete.firstName, athlete.lastName, athlete.country, countryName(athlete.country)]);
  const chosen = candidates.filter((c) => c.problems.length === 0 && selected.has(c.athlete.id)).map((c) => c.athlete.id);

  function changeCategory(value: string) {
    setCategoryId(Number(value));
    setSelected(new Set()); // eligibility differs per category
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void saveAndClose(() => add.mutateAsync({ competitionId: competition.id, categoryId, athleteIds: chosen }), onDone);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <FormField id="entry-category" label="Category">
          <Select value={categoryId.toString()} onValueChange={changeCategory}>
            <SelectTrigger id="entry-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name} <span className="text-muted-foreground">· {describeCategoryRules(c)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="flex items-center justify-between gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search athletes…" />
          {/* The missed athlete may not be in the database yet. */}
          <AnimatedButton type="button" icon={UserPlusIcon} variant="outline" onClick={() => setCreatingAthlete(true)}>
            New athlete
          </AnimatedButton>
        </div>

        {competition.status === "running" && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The competition is running: this is a late entry. The athlete keeps their bib if already entered in another category (or gets the
            next free one), starts with no results and is marked "Late entry".
          </p>
        )}

        <CheckList
          items={visible.map(({ athlete, problems }) => ({
            id: athlete.id,
            label: `${athlete.lastName} ${athlete.firstName}`,
            detail: `${SEX_LABELS[athlete.sex]} · ${ageOn(athlete.dateOfBirth, competition.date)} years · ${athlete.country}`,
            disabledReason: problems.length > 0 ? problems.join(" ") : undefined,
          }))}
          selected={selected}
          onToggle={(id, checked) => setSelected((current) => toggleInSet(current, id, checked))}
          empty={candidates.length === 0 ? "Every athlete is already entered in this category." : "No athlete matches the search."}
        />

        <FormActions
          onCancel={onDone}
          submitLabel={`Enter ${chosen.length || ""} athlete${chosen.length === 1 ? "" : "s"}`}
          saving={add.isPending}
          disabled={chosen.length === 0}
        />
      </form>
      {/* Outside the form: React bubbles a nested dialog's submit through portals into the parent form. */}
      <AthleteFormDialog athlete={null} open={creatingAthlete} onOpenChange={setCreatingAthlete} />
    </>
  );
}
