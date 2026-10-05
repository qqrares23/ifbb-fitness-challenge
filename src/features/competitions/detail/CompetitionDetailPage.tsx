import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftIcon } from "@/components/icons/arrow-left";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { PlayIcon } from "@/components/icons/play";
import { RotateCCWIcon } from "@/components/icons/rotate-ccw";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { useIconAnimation } from "@/components/icons/animated";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState } from "@/components/shared/QueryState";
import type { CompetitionSetup } from "@/db/competitions";
import { formatDate } from "@/lib/dates";
import { CompetitionFormDialog } from "../CompetitionFormDialog";
import { CompetitionKindBadge, CompetitionStatusBadge } from "../CompetitionBadges";
import { competitionPermissions } from "../permissions";
import { competitionReadiness } from "../readiness";
import { ExportButtons } from "../results/ExportButtons";
import { ResultsPanel } from "../results/ResultsPanel";
import { competitionResults, entriesWithResults, type CompetitionResults } from "../standings";
import { useCompetitionMutations, useCompetitionResults, useCompetitionSetup } from "../useCompetitions";
import { CategoriesPanel } from "./CategoriesPanel";
import { EntriesPanel } from "./EntriesPanel";
import { ReadinessCard } from "./ReadinessCard";
import { StationsPanel } from "./StationsPanel";

export function CompetitionDetailPage() {
  const id = Number(useParams().competitionId);
  const setupQuery = useCompetitionSetup(id);
  const back = useIconAnimation();

  return (
    <>
      <Link
        to="/competitions"
        {...back.triggers}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon ref={back.ref} size={16} /> Competitions
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
  const resultsQuery = useCompetitionResults(setup.competition, locked);
  // Setup is shown as soon as it loads; results only matter once the competition has started.
  if (locked && resultsQuery.status !== "success") return <QueryState query={resultsQuery}>{() => null}</QueryState>;
  return <CompetitionView setup={setup} results={resultsQuery.data ? competitionResults(setup, resultsQuery.data) : null} />;
}

function finishWarning(results: CompetitionResults): string {
  const missing = results.categories.reduce((sum, c) => sum + c.missingResults, 0);
  if (missing === 0) return "All results are in. Results will be locked and ready to export.";
  const plural = missing !== 1;
  return results.kind === "speed_fit"
    ? `${missing} athlete${plural ? "s have" : " has"} no time and will be listed without a place. Results will be locked.`
    : `${missing} station result${plural ? "s are" : " is"} still empty and will count as 0. Results will be locked.`;
}

function CompetitionView({ setup, results }: { setup: CompetitionSetup; results: CompetitionResults | null }) {
  const navigate = useNavigate();
  const { competition, stations, categories, entries } = setup;
  const { setStatus, remove } = useCompetitionMutations();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const locked = competition.status !== "draft";
  const permissions = competitionPermissions(competition.status);
  const speedFit = competition.kind === "speed_fit";
  const readiness = competitionReadiness(setup);
  const resultNoun = speedFit ? "time" : "rep";

  const actions = (
    <>
      <CompetitionKindBadge kind={competition.kind} />
      <CompetitionStatusBadge status={competition.status} />
      {!locked && (
        <AnimatedButton icon={SquarePenIcon} variant="outline" onClick={() => setEditing(true)}>
          Edit
        </AnimatedButton>
      )}
      <Button variant="outline" aria-label="Delete competition" onClick={() => setPending("delete")}>
        <Trash2 className="text-destructive" />
      </Button>
      {!locked && (
        <AnimatedButton icon={PlayIcon} disabled={readiness.blocking.length > 0} onClick={() => setPending("start")}>
          Start competition
        </AnimatedButton>
      )}
      {competition.status === "running" && (
        <AnimatedButton icon={CircleCheckIcon} onClick={() => setPending("finish")}>
          Finish competition
        </AnimatedButton>
      )}
      {competition.status === "finished" && results && (
        <>
          <AnimatedButton icon={RotateCCWIcon} variant="outline" onClick={() => setPending("reopen")}>
            Reopen
          </AnimatedButton>
          <ExportButtons setup={setup} results={results} />
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

      {/* Keyed by status so the default tab follows the competition into live entry / results. */}
      <Tabs key={competition.status} defaultValue={locked ? "results" : speedFit ? "categories" : "stations"}>
        <TabsList className="mb-4">
          {locked && <TabsTrigger value="results">{competition.status === "finished" ? "Results" : speedFit ? "Timing" : "Scoring"}</TabsTrigger>}
          {!speedFit && <TabsTrigger value="stations">Stations ({stations.length})</TabsTrigger>}
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="athletes">Athletes ({entries.length})</TabsTrigger>
        </TabsList>
        {locked && results && (
          <TabsContent value="results">
            <ResultsPanel setup={setup} results={results} editable={permissions.enterResults} />
          </TabsContent>
        )}
        {!speedFit && (
          <TabsContent value="stations">
            <StationsPanel setup={setup} locked={!permissions.editSetup} />
          </TabsContent>
        )}
        <TabsContent value="categories">
          <CategoriesPanel setup={setup} permissions={permissions} />
        </TabsContent>
        <TabsContent value="athletes">
          <EntriesPanel setup={setup} permissions={permissions} entryIdsWithResults={entriesWithResults(results)} />
        </TabsContent>
      </Tabs>

      <CompetitionFormDialog competition={competition} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={pending === "start"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Start the competition?"
        description={`${speedFit ? "Category rules" : "Stations and category rules"} will be locked and ${resultNoun} entry opens. Athletes missed out can still be entered late.`}
        confirmLabel="Start"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "running" })}
      />
      <ConfirmDialog
        open={pending === "finish"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Finish the competition?"
        description={results ? finishWarning(results) : ""}
        confirmLabel="Finish"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "finished" })}
      />
      <ConfirmDialog
        open={pending === "reopen"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Reopen the competition?"
        description={`Entry opens again so ${resultNoun}s can be corrected. The setup stays locked.`}
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
