import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import { formatDate } from "@/lib/dates";
import { CompetitionFormDialog } from "./CompetitionFormDialog";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { useCompetitions } from "./useCompetitions";

export function CompetitionsPage() {
  const navigate = useNavigate();
  const competitionsQuery = useCompetitions();
  const [creating, setCreating] = useState(false);

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus /> New competition
    </Button>
  );

  return (
    <>
      <PageHeader title="Competitions" description="Set up, run and export Fitness Challenge competitions." actions={newButton} />

      <QueryState query={competitionsQuery}>
        {(competitions) =>
          competitions.length === 0 ? (
            <EmptyState icon={Trophy} title="No competitions yet" description="Create a competition, then add its stations, categories and athletes." action={newButton} />
          ) : (
            <div className="rounded-xl border bg-background">
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
                  {competitions.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/competitions/${c.id}`)}>
                      <TableCell className="pl-4 font-medium">{c.name}</TableCell>
                      <TableCell>{formatDate(c.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.location || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.stationCount}</TableCell>
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
