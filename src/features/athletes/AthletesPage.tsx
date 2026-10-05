import { Users } from "lucide-react";
import { LibraryPage } from "@/components/shared/LibraryPage";
import type { Athlete } from "@/db/athletes";
import { ageOn } from "@/engine";
import { countryName } from "@/lib/countries";
import { formatDate, todayIso } from "@/lib/dates";
import { SEX_LABELS } from "@/lib/labels";
import { AthleteFormDialog } from "./AthleteFormDialog";
import { useAthleteMutations, useAthletes } from "./useAthletes";

const fullName = (a: Athlete) => `${a.firstName} ${a.lastName}`;

export function AthletesPage() {
  const { remove } = useAthleteMutations();
  const today = todayIso();

  return (
    <LibraryPage<Athlete>
      title="Athletes"
      description="Every athlete who can be entered into a competition."
      noun="athlete"
      emptyIcon={Users}
      emptyDescription="Add the athletes who will compete."
      query={useAthletes()}
      columns={[
        { header: "Surname", cell: (a) => a.lastName },
        { header: "Name", cell: (a) => a.firstName },
        { header: "Sex", cell: (a) => SEX_LABELS[a.sex] },
        { header: "Date of birth", cell: (a) => formatDate(a.dateOfBirth) },
        { header: "Age", cell: (a) => ageOn(a.dateOfBirth, today), className: "text-right tabular-nums" },
        {
          header: "Country",
          cell: (a) => (
            <>
              {countryName(a.country)} <span className="text-xs text-muted-foreground">{a.country}</span>
            </>
          ),
        },
      ]}
      searchPlaceholder="Search name or country…"
      searchFields={(a) => [a.firstName, a.lastName, a.country, countryName(a.country)]}
      itemName={fullName}
      deleteNote="An athlete already entered in a competition can't be deleted."
      onDelete={(athlete) => remove.mutate(athlete)}
      renderForm={({ item, open, onOpenChange }) => <AthleteFormDialog athlete={item} open={open} onOpenChange={onOpenChange} />}
    />
  );
}
