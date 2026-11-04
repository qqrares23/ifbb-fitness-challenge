import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CheckList, toggleInSet } from "@/components/shared/CheckList";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CompetitionKind, CompetitionSetup } from "@/db/competitions";
import type { Federation } from "@/db/categoryLibrary";
import { FederationPicker } from "@/features/categories/FederationPicker";
import { useCategoryLibrary } from "@/features/categories/useCategoryLibrary";
import { categoryName, COMPETITION_KIND_LABELS, describeCategoryRules, FEDERATION_LABELS } from "@/lib/labels";
import { useCategoryMutations } from "../useCompetitions";

interface AddCategoriesDialogProps {
  setup: CompetitionSetup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCategoriesDialog({ setup, open, onOpenChange }: AddCategoriesDialogProps) {
  return (
    <FormDialog title="Add categories from the library" open={open} onOpenChange={onOpenChange} formKey={String(open)} wide>
      {open && <AddCategoriesForm setup={setup} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function AddCategoriesForm({ setup, onDone }: { setup: CompetitionSetup; onDone: () => void }) {
  const [federation, setFederation] = useState<Federation>("ifbb");
  const [kind, setKind] = useState<CompetitionKind>(
    setup.categories.length > 0 && setup.categories.every((c) => c.kind === "speed_fit") ? "speed_fit" : "fitness_challenge",
  );
  const library = useCategoryLibrary({ federation, kind }).data ?? [];
  const { addFromLibrary } = useCategoryMutations();
  // "l<id>" = a level, "s<id>" = a sub-group without levels (a category on its own).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Names are unique per competition; the library is case-insensitive, so compare that way too.
  const taken = new Set(setup.categories.map((c) => c.name.toLowerCase()));
  // One item per level, or per sub-group without levels, in library order. Two library entries
  // can compose the same name; only the first of them can be picked.
  const listed = new Set<string>();
  const item = (id: string, name: string, detail: string) => {
    const key = name.toLowerCase();
    const disabledReason = taken.has(key) ? "Already in this competition." : listed.has(key) ? "Same name as a category above." : undefined;
    listed.add(key);
    return { id, label: name, detail, disabledReason };
  };
  const items = library.flatMap((group) =>
    group.subgroups.flatMap((subgroup) =>
      subgroup.levels.length === 0
        ? [item(`s${subgroup.id}`, categoryName(group.name, subgroup, "", kind), `${describeCategoryRules(subgroup)} · no levels`)]
        : subgroup.levels.map((level) => item(`l${level.id}`, categoryName(group.name, subgroup, level.name, kind), describeCategoryRules(subgroup))),
    ),
  );
  const chosen = items.filter((i) => !i.disabledReason && selected.has(i.id)).map((i) => i.id);
  const idsOf = (prefix: string) => chosen.filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(1)));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void saveAndClose(
      () => addFromLibrary.mutateAsync({ competitionId: setup.competition.id, levelIds: idsOf("l"), subgroupIds: idsOf("s") }),
      onDone,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <FederationPicker
        value={federation}
        onChange={(next) => {
          setFederation(next);
          setSelected(new Set());
        }}
      />
      {/* One library per challenge; a competition can mix Fitness Challenge and Speed Fit categories. */}
      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as CompetitionKind);
          setSelected(new Set());
        }}
      >
        <TabsList>
          {(Object.keys(COMPETITION_KIND_LABELS) as CompetitionKind[]).map((k) => (
            <TabsTrigger key={k} value={k} className="px-3">
              {COMPETITION_KIND_LABELS[k]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <CheckList
        items={items}
        selected={selected}
        onToggle={(id, checked) => setSelected((current) => toggleInSet(current, id, checked))}
        empty={
          <>
            The {FEDERATION_LABELS[federation]} {COMPETITION_KIND_LABELS[kind]} category library is empty.{" "}
            <Link to="/categories" className="font-medium text-foreground underline underline-offset-4">
              Create categories
            </Link>{" "}
            first.
          </>
        }
      />
      <FormActions
        onCancel={onDone}
        submitLabel={`Add ${chosen.length || ""} categor${chosen.length === 1 ? "y" : "ies"}`}
        saving={addFromLibrary.isPending}
        disabled={chosen.length === 0}
      />
    </form>
  );
}
