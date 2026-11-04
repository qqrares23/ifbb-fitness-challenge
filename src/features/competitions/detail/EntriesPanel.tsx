import { useState } from "react";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlusIcon } from "@/components/icons/user-plus";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { CommitNumberInput } from "@/components/shared/CommitInput";
import { CountryLabel } from "@/components/shared/CountryLabel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { ageOn } from "@/engine";
import { describeCategoryRules, entryFullName, listName } from "@/lib/labels";
import { LateEntryBadge } from "../CompetitionBadges";
import { canChangeCategory, type CompetitionPermissions } from "../permissions";
import { entryProblems } from "../readiness";
import { useEntryMutations } from "../useCompetitions";
import { AddEntriesDialog } from "./AddEntriesDialog";

interface EntriesPanelProps {
  setup: CompetitionSetup;
  permissions: CompetitionPermissions;
  /** Entries that already have results (can't change category, lose results when removed). */
  entryIdsWithResults: ReadonlySet<number>;
}

export function EntriesPanel({ setup, permissions, entryIdsWithResults }: EntriesPanelProps) {
  const { competition, categories, entries } = setup;
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const { remove } = useEntryMutations();
  const editable = permissions.editSetup;
  const started = competition.status !== "draft";

  if (categories.length === 0) {
    return <EmptyState icon={Users} title="Add a category first" description="Athletes are entered into a category of this competition." />;
  }

  const addButton = editable && (
    <AnimatedButton icon={UserPlusIcon} onClick={() => setAdding(true)}>
      {started ? "Enter late athlete" : "Enter athletes"}
    </AnimatedButton>
  );

  return (
    <div className="grid gap-6">
      {entries.length === 0 ? (
        <EmptyState icon={Users} title="No athletes entered" description="Numbers (Nr) are given automatically or set by hand, and can be changed." action={addButton} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {competition.status === "running" && "The competition is running: athletes can still be entered late, and numbers changed."}
              {competition.status === "finished" && "The competition is finished. Reopen it to add or remove athletes."}
            </p>
            {addButton}
          </div>
          {categories.map((category) => (
            <CategoryEntries
              key={category.id}
              setup={setup}
              category={category}
              entries={entries.filter((e) => e.categoryId === category.id)}
              permissions={permissions}
              entryIdsWithResults={entryIdsWithResults}
              onRemove={setRemoving}
            />
          ))}
        </>
      )}

      <AddEntriesDialog setup={setup} open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing?.team ? "Remove from the competition?" : "Remove athlete?"}
        description={
          removing
            ? `#${removing.bibNumber} ${entryFullName(removing)} will be taken out of "${categories.find((c) => c.id === removing.categoryId)?.name}"` +
              (entryIdsWithResults.has(removing.id) ? ", and the results already recorded there will be deleted." : ".") +
              " Their other categories are not affected."
            : ""
        }
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
  permissions: CompetitionPermissions;
  entryIdsWithResults: ReadonlySet<number>;
  onRemove: (entry: Entry) => void;
}

function CategoryEntries({ setup, category, entries, permissions, entryIdsWithResults, onRemove }: CategoryEntriesProps) {
  const { setCategory } = useEntryMutations();
  const date = setup.competition.date;
  const editable = permissions.editSetup;
  const noun = { individual: "athlete", couple: "couple", team: "team" }[category.format];

  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2">
        <span className="font-semibold">{category.name}</span>
        <span className="text-xs text-muted-foreground">
          {describeCategoryRules(category)} · {entries.length} {noun}
          {entries.length === 1 ? "" : "s"}
        </span>
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">No {noun}s in this category.</p>
      ) : (
        <div className="surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 pl-4">Nr</TableHead>
                <TableHead>{category.format === "individual" ? "Athlete" : "Athletes"}</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead>Country</TableHead>
                {editable && <TableHead className="w-56">Category</TableHead>}
                {editable && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const problems = entryProblems(entry, category, date);
                const movable = canChangeCategory(permissions, entryIdsWithResults.has(entry.id));
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-4">
                      {editable ? <BibInput entry={entry} /> : <span className="font-semibold tabular-nums">{entry.bibNumber}</span>}
                    </TableCell>
                    <TableCell>
                      {entry.members.map((member) => (
                        <span key={member.athleteId} className="block font-medium">
                          {listName(member)}
                        </span>
                      ))}
                      {entry.lateEntry && <LateEntryBadge />}
                      {problems.length > 0 && <span className="block text-xs text-destructive">{problems.join(" ")}</span>}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {entry.members.map((member) => (
                        <span key={member.athleteId} className="block">
                          {ageOn(member.dateOfBirth, date)}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="align-top">
                      {entry.members.map((member) => (
                        <span key={member.athleteId} className="block">
                          <CountryLabel code={member.country} />
                          {member.club && <span className="block text-xs text-muted-foreground">{member.club}</span>}
                        </span>
                      ))}
                    </TableCell>
                    {editable && (
                      <TableCell title={movable ? undefined : "Has results already — the category can't change."}>
                        <Select
                          value={entry.categoryId.toString()}
                          disabled={!movable}
                          onValueChange={(value) => setCategory.mutate({ entryId: entry.id, categoryId: Number(value) })}
                        >
                          <SelectTrigger className="w-full" aria-label="Move to category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* A couple or team only moves to another couple or team category (0013), and never between challenges (0016). */}
                            {setup.categories.filter((c) => c.format === category.format && c.kind === category.kind).map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {editable && (
                      <TableCell className="pr-4">
                        <Button variant="ghost" size="icon" aria-label={entry.team ? "Remove" : "Remove athlete"} onClick={() => onRemove(entry)}>
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
      aria-label="Nr"
      className="w-16 font-semibold"
      value={entry.bibNumber}
      min={1}
      max={99999}
      onCommit={(bibNumber) => setBib.mutateAsync({ entryId: entry.id, bibNumber: bibNumber! })}
    />
  );
}
