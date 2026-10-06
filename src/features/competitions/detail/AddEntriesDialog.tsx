import { useMemo, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
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
import { describeCategoryRules, listName, SEX_LABELS } from "@/lib/labels";
import { filterBySearch } from "@/lib/search";
import { cn } from "@/lib/utils";
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
  const [numbering, setNumbering] = useState<"auto" | "manual">("auto");
  const [typedNumbers, setTypedNumbers] = useState<Record<number, string>>({});
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
  const chosen = candidates.filter((c) => c.problems.length === 0 && selected.has(c.athlete.id)).map((c) => c.athlete);

  // An athlete already in another category keeps their number; anyone else can get one typed in.
  const existingNumber = new Map(entries.map((e) => [e.athleteId, e.bibNumber]));
  const numberOwner = new Map(entries.map((e) => [e.bibNumber, e.athleteId]));
  const manualNumbers = chosen.map((athlete) => {
    const text = numbering === "manual" && !existingNumber.has(athlete.id) ? (typedNumbers[athlete.id] ?? "").trim() : "";
    return text === "" ? null : Number(text);
  });
  const numberErrors = chosen.map((athlete, i) => {
    const n = manualNumbers[i];
    if (n === null || n === undefined) return undefined;
    if (!Number.isInteger(n) || n < 1) return "Enter a whole number of 1 or more.";
    const owner = numberOwner.get(n);
    if (owner !== undefined && owner !== athlete.id) return `Nr ${n} is already used in this competition.`;
    if (manualNumbers.indexOf(n) !== i) return `Nr ${n} is typed twice.`;
    return undefined;
  });
  const hasNumberErrors = numberErrors.some(Boolean);

  function changeCategory(value: string) {
    setCategoryId(Number(value));
    setSelected(new Set()); // eligibility differs per category
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasNumberErrors) return;
    void saveAndClose(
      () => add.mutateAsync({ competitionId: competition.id, categoryId, athleteIds: chosen.map((a) => a.id), bibNumbers: manualNumbers }),
      onDone,
    );
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
            The competition is running: this is a late entry. The athlete keeps their number if already entered in another category, starts with
            no results and is marked "Late entry".
          </p>
        )}

        <CheckList
          items={visible.map(({ athlete, problems }) => ({
            id: athlete.id,
            label: listName(athlete),
            detail: `${SEX_LABELS[athlete.sex]} · ${ageOn(athlete.dateOfBirth, competition.date)} years · ${athlete.country}`,
            disabledReason: problems.length > 0 ? problems.join(" ") : undefined,
          }))}
          selected={selected}
          onToggle={(id, checked) => setSelected((current) => toggleInSet(current, id, checked))}
          empty={candidates.length === 0 ? "Every athlete is already entered in this category." : "No athlete matches the search."}
        />

        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Nr</span>
            <div role="radiogroup" aria-label="Numbering" className="inline-flex rounded-lg border p-0.5">
              {(["auto", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={numbering === mode}
                  onClick={() => setNumbering(mode)}
                  className={cn("rounded-md px-3 py-1 text-sm transition-colors", numbering === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {mode === "auto" ? "Automatic" : "Set manually"}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {numbering === "auto" ? "The next free numbers are given out." : "Leave a field empty to give that athlete the next free number."}
            </span>
          </div>
          {numbering === "manual" && chosen.length > 0 && (
            <ul className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {chosen.map((athlete, i) => (
                <li key={athlete.id} className="flex items-start gap-2">
                  <Input
                    aria-label={`Nr for ${listName(athlete)}`}
                    inputMode="numeric"
                    className="h-8 w-20 tabular-nums"
                    placeholder="Auto"
                    disabled={existingNumber.has(athlete.id)}
                    value={existingNumber.has(athlete.id) ? String(existingNumber.get(athlete.id)) : (typedNumbers[athlete.id] ?? "")}
                    onChange={(e) => setTypedNumbers((current) => ({ ...current, [athlete.id]: e.target.value }))}
                  />
                  <span className="min-w-0 pt-1.5 text-sm">
                    <span className="block truncate">{listName(athlete)}</span>
                    {existingNumber.has(athlete.id) && <span className="block text-xs text-muted-foreground">Keeps their number from another category.</span>}
                    {numberErrors[i] && <span className="block text-xs text-destructive">{numberErrors[i]}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormActions
          onCancel={onDone}
          submitLabel={`Enter ${chosen.length || ""} athlete${chosen.length === 1 ? "" : "s"}`}
          saving={add.isPending}
          disabled={chosen.length === 0 || hasNumberErrors}
        />
      </form>
      {/* Outside the form: React bubbles a nested dialog's submit through portals into the parent form. */}
      <AthleteFormDialog athlete={null} open={creatingAthlete} onOpenChange={setCreatingAthlete} />
    </>
  );
}
