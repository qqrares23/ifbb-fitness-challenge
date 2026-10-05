import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Flag, Pencil, Play, RotateCcw, SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import type { CompetitionSetup } from "@/db/competitions";
import type { RepScore } from "@/engine";
import { formatDate } from "@/lib/dates";
import { CompetitionFormDialog } from "../CompetitionFormDialog";
import { CompetitionStatusBadge } from "../CompetitionStatusBadge";
import { competitionReadiness } from "../readiness";
import { ExportButtons } from "../scoring/ExportButtons";
import { ScoringPanel } from "../scoring/ScoringPanel";
import { competitionStandings } from "../standings";
import { useCompetitionMutations, useCompetitionScores, useCompetitionSetup } from "../useCompetitions";
import { CategoriesPanel } from "./CategoriesPanel";
import { EntriesPanel } from "./EntriesPanel";
import { ReadinessCard } from "./ReadinessCard";
import { StationsPanel } from "./StationsPanel";

export function CompetitionDetailPage() {
  const id = Number(useParams().competitionId);
  const setupQuery = useCompetitionSetup(id);

  return (
    <>
      <Link to="/competitions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Competitions
      </Link>
      <QueryState query={setupQuery}>
        {(setup) => (setup ? <CompetitionDetail setup={setup} /> : <EmptyState icon={SearchX} title="Competition not found" />)}
      </QueryState>
    </>
  );
}

type PendingAction = "start" | "finish" | "reopen" | "delete" | null;

function CompetitionDetail({ setup }: { setup: CompetitionSetup }) {
  const locked = setup.competition.status !== "draft";
  const scoresQuery = useCompetitionScores(setup.competition.id, locked);
  // Setup is shown as soon as it loads; the scores only matter once the competition has started.
  if (locked && scoresQuery.status !== "success") return <QueryState query={scoresQuery}>{() => null}</QueryState>;
  return <CompetitionView setup={setup} scores={scoresQuery.data ?? []} />;
}

function CompetitionView({ setup, scores }: { setup: CompetitionSetup; scores: RepScore[] }) {
  const navigate = useNavigate();
  const { competition, stations, categories, entries } = setup;
  const { setStatus, remove } = useCompetitionMutations();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const locked = competition.status !== "draft";
  const readiness = competitionReadiness(setup);
  const standings = locked ? competitionStandings(setup, scores) : [];
  const missingResults = standings.reduce((sum, s) => sum + s.missingResults, 0);

  const actions = (
    <>
      <CompetitionStatusBadge status={competition.status} />
      {!locked && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      )}
      <Button variant="outline" aria-label="Delete competition" onClick={() => setPending("delete")}>
        <Trash2 className="text-destructive" />
      </Button>
      {!locked && (
        <Button disabled={readiness.blocking.length > 0} onClick={() => setPending("start")}>
          <Play /> Start competition
        </Button>
      )}
      {competition.status === "running" && (
        <Button onClick={() => setPending("finish")}>
          <Flag /> Finish competition
        </Button>
      )}
      {competition.status === "finished" && (
        <>
          <Button variant="outline" onClick={() => setPending("reopen")}>
            <RotateCcw /> Reopen
          </Button>
          <ExportButtons setup={setup} standings={standings} />
        </>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title={competition.name}
        description={[formatDate(competition.date), competition.location].filter(Boolean).join(" · ")}
        actions={actions}
      />

      {!locked && <ReadinessCard readiness={readiness} />}

      {/* Keyed by status so the default tab follows the competition into scoring / results. */}
      <Tabs key={competition.status} defaultValue={locked ? "scoring" : "stations"}>
        <TabsList className="mb-4">
          {locked && <TabsTrigger value="scoring">{competition.status === "running" ? "Scoring" : "Results"}</TabsTrigger>}
          <TabsTrigger value="stations">Stations ({stations.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="athletes">Athletes ({entries.length})</TabsTrigger>
        </TabsList>
        {locked && (
          <TabsContent value="scoring">
            <ScoringPanel setup={setup} standings={standings} editable={competition.status === "running"} />
          </TabsContent>
        )}
        <TabsContent value="stations">
          <StationsPanel setup={setup} locked={locked} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesPanel setup={setup} locked={locked} />
        </TabsContent>
        <TabsContent value="athletes">
          <EntriesPanel setup={setup} locked={locked} />
        </TabsContent>
      </Tabs>

      <CompetitionFormDialog competition={competition} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={pending === "start"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Start the competition?"
        description="Stations, categories and the athlete list will be locked, and rep entry opens."
        confirmLabel="Start"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "running" })}
      />
      <ConfirmDialog
        open={pending === "finish"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Finish the competition?"
        description={
          missingResults > 0
            ? `${missingResults} station result${missingResults === 1 ? " is" : "s are"} still empty and will count as 0. Results will be locked.`
            : "All results are in. Results will be locked and ready to export."
        }
        confirmLabel="Finish"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "finished" })}
      />
      <ConfirmDialog
        open={pending === "reopen"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Reopen the competition?"
        description="Rep entry opens again so results can be corrected. Stations, categories and athletes stay locked."
        confirmLabel="Reopen"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "running" })}
      />
      <ConfirmDialog
        open={pending === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete competition?"
        description={`"${competition.name}" will be deleted permanently${locked ? ", including every recorded result" : ""}.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutate(competition.id, { onSuccess: () => navigate("/competitions") })}
      />
    </>
  );
}
