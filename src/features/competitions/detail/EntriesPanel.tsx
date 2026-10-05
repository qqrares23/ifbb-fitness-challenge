import { useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommitNumberInput } from "@/components/shared/CommitNumberInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { ageOn, eligibilityProblems } from "@/engine";
import { countryName } from "@/lib/countries";
import { describeCategoryRules } from "@/lib/labels";
import { useEntryMutations } from "../useCompetitions";
import { AddEntriesDialog } from "./AddEntriesDialog";

interface EntriesPanelProps {
  setup: CompetitionSetup;
  locked: boolean;
}

export function EntriesPanel({ setup, locked }: EntriesPanelProps) {
  const { categories, entries } = setup;
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const { remove } = useEntryMutations();

  if (categories.length === 0) {
    return <EmptyState icon={Users} title="Add a category first" description="Athletes are entered into a category of this competition." />;
  }

  const addButton = !locked && (
    <Button onClick={() => setAdding(true)}>
      <UserPlus /> Enter athletes
    </Button>
  );

  return (
    <div className="grid gap-6">
      {entries.length === 0 ? (
        <EmptyState icon={Users} title="No athletes entered" description="Bib numbers are assigned automatically and can be changed." action={addButton} />
      ) : (
        <>
          <div className="flex justify-end">{addButton}</div>
          {categories.map((category) => (
            <CategoryEntries
              key={category.id}
              setup={setup}
              category={category}
              entries={entries.filter((e) => e.categoryId === category.id)}
              locked={locked}
              onRemove={setRemoving}
            />
          ))}
        </>
      )}

      <AddEntriesDialog setup={setup} open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove athlete?"
        description={removing ? `#${removing.bibNumber} ${removing.firstName} ${removing.lastName} will be taken out of this competition.` : ""}
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

interface CategoryEntriesProps {
  setup: CompetitionSetup;
  category: Category;
  entries: Entry[];
  locked: boolean;
  onRemove: (entry: Entry) => void;
}

function CategoryEntries({ setup, category, entries, locked, onRemove }: CategoryEntriesProps) {
  const { setCategory } = useEntryMutations();
  const date = setup.competition.date;

  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2">
        <span className="font-semibold">{category.name}</span>
        <span className="text-xs text-muted-foreground">
          {describeCategoryRules(category)} · {entries.length} athlete{entries.length === 1 ? "" : "s"}
        </span>
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">No athletes in this category.</p>
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 pl-4">Bib</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead>Country</TableHead>
                {!locked && <TableHead className="w-56">Category</TableHead>}
                {!locked && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const problems = eligibilityProblems(entry, category, date);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-4">
                      {locked ? <span className="font-semibold tabular-nums">{entry.bibNumber}</span> : <BibInput entry={entry} />}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {entry.lastName} {entry.firstName}
                      </span>
                      {problems.length > 0 && <span className="block text-xs text-destructive">{problems.join(" ")}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ageOn(entry.dateOfBirth, date)}</TableCell>
                    <TableCell>
                      {countryName(entry.country)} <span className="text-xs text-muted-foreground">{entry.country}</span>
                    </TableCell>
                    {!locked && (
                      <TableCell>
                        <Select value={entry.categoryId.toString()} onValueChange={(value) => setCategory.mutate({ entryId: entry.id, categoryId: Number(value) })}>
                          <SelectTrigger className="w-full" aria-label="Move to category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {setup.categories.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {!locked && (
                      <TableCell className="pr-4">
                        <Button variant="ghost" size="icon" aria-label="Remove athlete" onClick={() => onRemove(entry)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function BibInput({ entry }: { entry: Entry }) {
  const { setBib } = useEntryMutations();
  return (
    <CommitNumberInput
      aria-label="Bib number"
      className="w-16 font-semibold"
      value={entry.bibNumber}
      min={1}
      max={99999}
      onCommit={(bibNumber) => setBib.mutateAsync({ entryId: entry.id, bibNumber: bibNumber! })}
    />
  );
}
