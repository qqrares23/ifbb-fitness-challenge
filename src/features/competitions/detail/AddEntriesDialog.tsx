import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { SearchInput } from "@/components/shared/SearchInput";
import type { CompetitionSetup } from "@/db/competitions";
import { ageOn, eligibilityProblems } from "@/engine";
import { useAthletes } from "@/features/athletes/useAthletes";
import { countryName } from "@/lib/countries";
import { describeCategoryRules, SEX_LABELS } from "@/lib/labels";
import { filterBySearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useEntryMutations } from "../useCompetitions";

interface AddEntriesDialogProps {
  setup: CompetitionSetup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEntriesDialog({ setup, open, onOpenChange }: AddEntriesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enter athletes</DialogTitle>
        </DialogHeader>
        {open && <AddEntriesForm setup={setup} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddEntriesForm({ setup, onDone }: { setup: CompetitionSetup; onDone: () => void }) {
  const { competition, categories, entries } = setup;
  const athletes = useAthletes().data ?? [];
  const { add } = useEntryMutations();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const category = categories.find((c) => c.id === categoryId);

  // One entry per athlete per competition: anyone already entered is not offered again.
  const candidates = useMemo(() => {
    const entered = new Set(entries.map((e) => e.athleteId));
    return athletes
      .filter((a) => !entered.has(a.id))
      .map((athlete) => ({ athlete, problems: category ? eligibilityProblems(athlete, category, competition.date) : [] }))
      .sort((a, b) => a.problems.length - b.problems.length);
  }, [athletes, entries, category, competition.date]);

  const visible = filterBySearch(candidates, search, ({ athlete }) => [athlete.firstName, athlete.lastName, athlete.country, countryName(athlete.country)]);
  const eligibleSelected = candidates.filter((c) => c.problems.length === 0 && selected.has(c.athlete.id)).map((c) => c.athlete.id);

  function changeCategory(value: string) {
    setCategoryId(Number(value));
    setSelected(new Set()); // eligibility differs per category
  }

  function toggle(athleteId: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(athleteId);
      else next.delete(athleteId);
      return next;
    });
  }

  function submit() {
    add.mutate({ competitionId: competition.id, categoryId, athleteIds: eligibleSelected }, { onSuccess: onDone });
  }

  return (
    <div className="grid gap-4">
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

      <SearchInput value={search} onChange={setSearch} placeholder="Search athletes…" />

      <div className="max-h-[45vh] overflow-y-auto rounded-xl border">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {candidates.length === 0 ? "Every athlete is already entered in this competition." : "No athlete matches the search."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map(({ athlete, problems }) => {
              const eligible = problems.length === 0;
              const id = `entry-athlete-${athlete.id}`;
              return (
                <li key={athlete.id}>
                  <label htmlFor={id} className={cn("flex items-start gap-3 px-4 py-2.5", eligible ? "cursor-pointer hover:bg-muted/50" : "opacity-60")}>
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      disabled={!eligible}
                      checked={eligible && selected.has(athlete.id)}
                      onCheckedChange={(checked) => toggle(athlete.id, checked === true)}
                    />
                    <span className="flex-1">
                      <span className="font-medium">
                        {athlete.lastName} {athlete.firstName}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {SEX_LABELS[athlete.sex]} · {ageOn(athlete.dateOfBirth, competition.date)} years · {athlete.country}
                      </span>
                      {!eligible && <span className="block text-xs text-destructive">{problems.join(" ")}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={eligibleSelected.length === 0 || add.isPending}>
          Enter {eligibleSelected.length || ""} athlete{eligibleSelected.length === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </div>
  );
}
