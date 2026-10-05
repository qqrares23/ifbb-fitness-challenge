import { RowActions } from "@/components/shared/RowActions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Athlete } from "@/db/athletes";
import { ageOn } from "@/engine";
import { countryName } from "@/lib/countries";
import { formatDate, todayIso } from "@/lib/dates";
import { SEX_LABELS } from "@/lib/labels";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";

interface AthletesTableProps {
  athletes: readonly Athlete[];
  onEdit: (athlete: Athlete) => void;
  onDelete: (athlete: Athlete) => void;
}

export function AthletesTable({ athletes, onEdit, onDelete }: AthletesTableProps) {
  const today = todayIso();
  return (
    <div className="overflow-hidden surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Surname</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>Date of birth</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {athletes.map((athlete, index) => (
            <TableRow key={athlete.id} className={ROW_ENTER} style={staggerStyle(index)}>
              <TableCell className="pl-4 font-medium">{athlete.lastName}</TableCell>
              <TableCell>{athlete.firstName}</TableCell>
              <TableCell>{SEX_LABELS[athlete.sex]}</TableCell>
              <TableCell>{formatDate(athlete.dateOfBirth)}</TableCell>
              <TableCell className="text-right tabular-nums">{ageOn(athlete.dateOfBirth, today)}</TableCell>
              <TableCell>
                {countryName(athlete.country)} <span className="text-xs text-muted-foreground">{athlete.country}</span>
              </TableCell>
              <TableCell className="pr-4">
                <RowActions noun="athlete" onEdit={() => onEdit(athlete)} onDelete={() => onDelete(athlete)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
