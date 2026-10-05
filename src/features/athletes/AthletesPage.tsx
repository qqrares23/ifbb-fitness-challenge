import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import { SearchInput } from "@/components/shared/SearchInput";
import type { Athlete } from "@/db/athletes";
import { countryName } from "@/lib/countries";
import { filterBySearch } from "@/lib/search";
import { AthleteFormDialog } from "./AthleteFormDialog";
import { AthletesTable } from "./AthletesTable";
import { useAthleteMutations, useAthletes } from "./useAthletes";

export function AthletesPage() {
  const athletesQuery = useAthletes();
  const { remove } = useAthleteMutations();
  const [search, setSearch] = useState("");
  /** undefined = closed, null = adding a new athlete. */
  const [editing, setEditing] = useState<Athlete | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Athlete | null>(null);

  const filtered = useMemo(
    () => filterBySearch(athletesQuery.data ?? [], search, (a) => [a.firstName, a.lastName, a.country, countryName(a.country)]),
    [athletesQuery.data, search],
  );

  const addButton = (
    <Button onClick={() => setEditing(null)}>
      <Plus /> Add athlete
    </Button>
  );

  return (
    <>
      <PageHeader title="Athletes" description="Every athlete who can be entered into a competition." actions={addButton} />

      <QueryState query={athletesQuery}>
        {(athletes) =>
          athletes.length === 0 ? (
            <EmptyState icon={Users} title="No athletes yet" description="Add the athletes who will compete." action={addButton} />
          ) : (
            <div className="grid gap-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search name or country…" />
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No athlete matches "{search}".</p>
              ) : (
                <AthletesTable athletes={filtered} onEdit={setEditing} onDelete={setDeleting} />
              )}
              <p className="text-xs text-muted-foreground">
                {filtered.length} of {athletes.length} athletes
              </p>
            </div>
          )
        }
      </QueryState>

      <AthleteFormDialog
        athlete={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete athlete?"
        description={deleting ? `${deleting.firstName} ${deleting.lastName} will be removed permanently.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
