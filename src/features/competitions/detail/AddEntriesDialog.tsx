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
import type { Entry } from "@/db/entries";
import { ageOn, eligibilityProblems, FORMAT_SIZE } from "@/engine";
import { AthleteFormDialog } from "@/features/athletes/AthleteFormDialog";
import { useAthletes } from "@/features/athletes/useAthletes";
import { countryName } from "@/lib/countries";
import { describeCategoryRules, listName, SEX_LABELS } from "@/lib/labels";
import { parseWholeNumber } from "@/lib/numbers";
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

/** Who a number belongs to: an athlete (all their individual entries) or one couple / team. */
const numberOwnerKey = (entry: Entry) => (entry.team ? `entry ${entry.id}` : `athlete ${entry.athleteId}`);

interface AddEntriesFormProps {
  setup: CompetitionSetup;
  initialCategoryId?: number;
  onDone: () => void;
}

function AddEntriesForm({ setup, initialCategoryId, onDone }: AddEntriesFormProps) {
  const { competition, categories, entries } = setup;
  const athletes = useAthletes().data ?? [];
  const { add, addTeam } = useEntryMutations();
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? 0);
  const [creatingAthlete, setCreatingAthlete] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [numbering, setNumbering] = useState<"auto" | "manual">("auto");
  const [typedNumbers, setTypedNumbers] = useState<Record<number, string>>({});
  const category = categories.find((c) => c.id === categoryId);
  // A couple or team category: the ticked athletes become one entry with one number.
  const teamSize = category ? FORMAT_SIZE[category.format] : 1;
  const teamMode = teamSize > 1;
  const teamNoun = category?.format === "couple" ? "couple" : "team";

  // An athlete can enter several categories (levels), but each one only once (alone or in one couple / team).
  const candidates = useMemo(() => {
    const entered = new Set(entries.filter((e) => e.categoryId === categoryId).flatMap((e) => e.members.map((m) => m.athleteId)));
    return athletes
      .filter((a) => !entered.has(a.id))
      .map((athlete) => ({ athlete, problems: category ? eligibilityProblems(athlete, category, competition.date) : [] }))
      .sort((a, b) => a.problems.length - b.problems.length);
  }, [athletes, entries, categoryId, category, competition.date]);

  const visible = filterBySearch(candidates, search, ({ athlete }) => [athlete.firstName, athlete.lastName, athlete.country, countryName(athlete.country)]);
  const chosen = candidates.filter((c) => c.problems.length === 0 && selected.has(c.athlete.id)).map((c) => c.athlete);
  const teamFull = teamMode && chosen.length >= teamSize;

  // Numbers are typed per row: one per athlete, or one for the whole couple / team (id 0).
  // An athlete already in another individual category keeps their number.
  const existingNumber = new Map(entries.filter((e) => !e.team).map((e) => [e.athleteId, e.bibNumber]));
  const numberOwner = new Map(entries.map((e) => [e.bibNumber, numberOwnerKey(e)]));
  const numberRows = teamMode
    ? chosen.length > 0
      ? [{ id: 0, label: chosen.map(listName).join(" / "), owner: "new team", existing: undefined }]
      : []
    : chosen.map((athlete) => ({ id: athlete.id, label: listName(athlete), owner: `athlete ${athlete.id}`, existing: existingNumber.get(athlete.id) }));
  const manualNumbers = numberRows.map((row) => {
    const text = numbering === "manual" && row.existing === undefined ? (typedNumbers[row.id] ?? "").trim() : "";
    return text === "" ? null : (parseWholeNumber(text) ?? NaN);
  });
  const numberErrors = numberRows.map((row, i) => {
    const n = manualNumbers[i];
    if (n === null || n === undefined) return undefined;
    if (!Number.isInteger(n) || n < 1) return "Enter a whole number of 1 or more.";
    const owner = numberOwner.get(n);
    if (owner !== undefined && owner !== row.owner) return `Nr ${n} is already used in this competition.`;
    if (manualNumbers.indexOf(n) !== i) return `Nr ${n} is typed twice.`;
    return undefined;
  });
  const hasNumberErrors = numberErrors.some(Boolean);
  const canSubmit = (teamMode ? chosen.length === teamSize : chosen.length > 0) && !hasNumberErrors;

  function changeCategory(value: string) {
    setCategoryId(Number(value));
    setSelected(new Set()); // eligibility differs per category
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const athleteIds = chosen.map((a) => a.id);
    void saveAndClose(
      () =>
        teamMode
          ? addTeam.mutateAsync({ competitionId: competition.id, categoryId, size: teamSize, athleteIds, bibNumber: manualNumbers[0] ?? null })
          : add.mutateAsync({ competitionId: competition.id, categoryId, athleteIds, bibNumbers: manualNumbers }),
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
            The competition is running: this is a late entry.{" "}
            {teamMode
              ? `The ${teamNoun} gets its own number, starts with no results and is marked "Late entry".`
              : 'The athlete keeps their number if already entered in another category, starts with no results and is marked "Late entry".'}
          </p>
        )}

        {teamMode && (
          <p className="text-sm text-muted-foreground">
            Tick the {teamSize} athletes of one {teamNoun} ({chosen.length} of {teamSize} ticked). The {teamNoun} gets one number and one result.
          </p>
        )}

        <CheckList
          items={visible.map(({ athlete, problems }) => ({
            id: athlete.id,
            label: listName(athlete),
            detail: `${SEX_LABELS[athlete.sex]} · ${ageOn(athlete.dateOfBirth, competition.date)} years · ${athlete.country}`,
            disabledReason:
              problems.length > 0
                ? problems.join(" ")
                : teamFull && !selected.has(athlete.id)
                  ? `A ${teamNoun} has ${teamSize} athletes.`
                  : undefined,
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
              {numbering === "auto"
                ? "The next free numbers are given out."
                : `Leave a field empty to give that ${teamMode ? teamNoun : "athlete"} the next free number.`}
            </span>
          </div>
          {numbering === "manual" && numberRows.length > 0 && (
            <ul className={cn("grid max-h-48 gap-2 overflow-y-auto rounded-xl border p-3", !teamMode && "sm:grid-cols-2")}>
              {numberRows.map((row, i) => (
                <li key={row.id} className="flex items-start gap-2">
                  <Input
                    aria-label={`Nr for ${row.label}`}
                    inputMode="numeric"
                    className="h-8 w-20 tabular-nums"
                    placeholder="Auto"
                    disabled={row.existing !== undefined}
                    value={row.existing !== undefined ? String(row.existing) : (typedNumbers[row.id] ?? "")}
                    onChange={(e) => setTypedNumbers((current) => ({ ...current, [row.id]: e.target.value }))}
                  />
                  <span className="min-w-0 pt-1.5 text-sm">
                    <span className="block truncate">{row.label}</span>
                    {row.existing !== undefined && <span className="block text-xs text-muted-foreground">Keeps their number from another category.</span>}
                    {numberErrors[i] && <span className="block text-xs text-destructive">{numberErrors[i]}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormActions
          onCancel={onDone}
          submitLabel={teamMode ? `Enter ${teamNoun}` : `Enter ${chosen.length || ""} athlete${chosen.length === 1 ? "" : "s"}`}
          saving={add.isPending || addTeam.isPending}
          disabled={!canSubmit}
        />
      </form>
      {/* Outside the form: React bubbles a nested dialog's submit through portals into the parent form. */}
      <AthleteFormDialog athlete={null} open={creatingAthlete} onOpenChange={setCreatingAthlete} />
    </>
  );
}
