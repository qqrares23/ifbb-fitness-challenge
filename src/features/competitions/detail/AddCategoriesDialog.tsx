import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CheckList, toggleInSet } from "@/components/shared/CheckList";
import { FormActions, FormDialog, saveAndClose } from "@/components/shared/FormDialog";
import type { CompetitionSetup } from "@/db/competitions";
import { useCategoryLibrary } from "@/features/categories/useCategoryLibrary";
import { categoryName, describeCategoryRules } from "@/lib/labels";
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
  const library = useCategoryLibrary().data ?? [];
  const { addFromLibrary } = useCategoryMutations();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Names are unique per competition; the library is case-insensitive, so compare that way too.
  const taken = new Set(setup.categories.map((c) => c.name.toLowerCase()));
  // One item per level, in library order (age group → sub-group → level).
  const items = library.flatMap((group) =>
    group.subgroups.flatMap((subgroup) =>
      subgroup.levels.map((level) => {
        const name = categoryName(group.name, subgroup, level.name);
        return {
          id: level.id,
          label: name,
          detail: describeCategoryRules(subgroup),
          disabledReason: taken.has(name.toLowerCase()) ? "Already in this competition." : undefined,
        };
      }),
    ),
  );
  const chosen = items.filter((item) => !item.disabledReason && selected.has(item.id)).map((item) => item.id);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void saveAndClose(() => addFromLibrary.mutateAsync({ competitionId: setup.competition.id, levelIds: chosen }), onDone);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <CheckList
        items={items}
        selected={selected}
        onToggle={(id, checked) => setSelected((current) => toggleInSet(current, id, checked))}
        empty={
          <>
            The category library has no levels yet.{" "}
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
