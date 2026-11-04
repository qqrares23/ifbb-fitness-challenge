import { useState } from "react";
import { useNavigate } from "react-router";
import { Trophy } from "lucide-react";
import { PlusIcon } from "@/components/icons/plus";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import { formatDateRange } from "@/lib/dates";
import { CompetitionFormDialog } from "./CompetitionFormDialog";
import { ROW_ENTER, staggerStyle } from "@/lib/motion";
import { CompetitionStatusBadge } from "./CompetitionBadges";
import { useCompetitions } from "./useCompetitions";

export function CompetitionsPage() {
  const navigate = useNavigate();
  const competitionsQuery = useCompetitions();
  const [creating, setCreating] = useState(false);

  const newButton = (
    <AnimatedButton icon={PlusIcon} onClick={() => setCreating(true)}>
      New competition
    </AnimatedButton>
  );

  return (
    <>
      <PageHeader title="Competitions" description="Set up, run and export Fitness Challenge competitions." actions={newButton} />

      <QueryState query={competitionsQuery}>
        {(competitions) =>
          competitions.length === 0 ? (
            <EmptyState icon={Trophy} title="No competitions yet" description="Create a Fitness Challenge or Speed Fit competition, then add its categories and athletes." action={newButton} />
          ) : (
            <div className="overflow-hidden surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Competition</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Stations</TableHead>
                    <TableHead className="text-right">Categories</TableHead>
                    <TableHead className="text-right">Athletes</TableHead>
                    <TableHead className="pr-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitions.map((c, index) => (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer ${ROW_ENTER}`}
                      style={staggerStyle(index)}
                      onClick={() => navigate(`/competitions/${c.id}`)}
                    >
                      <TableCell className="pl-4">
                        <span className="block font-medium">{c.name}</span>
                      </TableCell>
                      <TableCell>{formatDateRange(c.date, c.endDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.location || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.categoryCount > 0 && c.speedFitCount === c.categoryCount ? "—" : c.setCount > 1 ? `${c.stationCount} in ${c.setCount} sets` : c.stationCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.categoryCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.entryCount}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <CompetitionStatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </QueryState>

      <CompetitionFormDialog competition={null} open={creating} onOpenChange={setCreating} />
    </>
  );
}
