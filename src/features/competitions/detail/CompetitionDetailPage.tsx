import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { SearchX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftIcon } from "@/components/icons/arrow-left";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { PlayIcon } from "@/components/icons/play";
import { RefreshCCWIcon } from "@/components/icons/refresh-ccw";
import { RotateCCWIcon } from "@/components/icons/rotate-ccw";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { Trash2Icon } from "@/components/icons/trash-2";
import { useIconAnimation } from "@/components/icons/animated";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { useHeldWhileTyping } from "@/components/shared/CommitInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryState, RefreshFailed } from "@/components/shared/QueryState";
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

type PendingAction = "start" | "finish" | "reopen" | "restart" | "clearResults" | "delete" | null;

function CompetitionDetail({ setup }: { setup: CompetitionSetup }) {
  const locked = setup.competition.status !== "draft";
  const resultsQuery = useCompetitionResults(setup.competition, locked);
  const recorded = useHeldWhileTyping(resultsQuery.data);
  // Setup is shown as soon as it loads; results only matter once the competition has started.
  if (locked && !resultsQuery.data) return <QueryState query={resultsQuery}>{() => null}</QueryState>;
  return (
    <>
      {locked && <RefreshFailed query={resultsQuery} />}
      <CompetitionView
        setup={setup}
        results={recorded ? competitionResults(setup, recorded) : null}
        resultsStale={locked && resultsQuery.isRefetchError}
        entryIdsWithResults={entriesWithResults(recorded)}
      />
    </>
  );
}

function finishWarning(results: CompetitionResults): string {
  const missing = results.categories.reduce((sum, c) => sum + c.missingResults, 0);
  if (missing === 0) return "All results are in. Results will be locked and ready to export.";
  const plural = missing !== 1;
  return results.kind === "speed_fit"
    ? `${missing} athlete${plural ? "s have" : " has"} no time and will be listed without a place. Results will be locked.`
    : `${missing} station result${plural ? "s are" : " is"} still empty and will count as 0; an athlete with no reps at all is listed without a place. Results will be locked.`;
}

interface CompetitionViewProps {
  setup: CompetitionSetup;
  results: CompetitionResults | null;
  /** The last refresh failed, so `results` may be missing some: not fit for official exports. */
  resultsStale: boolean;
  entryIdsWithResults: ReadonlySet<number>;
}

function CompetitionView({ setup, results, resultsStale, entryIdsWithResults }: CompetitionViewProps) {
  const navigate = useNavigate();
  const { competition, stationSets, categories, entries } = setup;
  const { setStatus, clearResults, remove } = useCompetitionMutations();
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
      {permissions.editDetails && (
        <AnimatedButton icon={SquarePenIcon} variant="outline" onClick={() => setEditing(true)}>
          Edit
        </AnimatedButton>
      )}
      <AnimatedButton icon={Trash2Icon} iconClassName="text-destructive" variant="outline" aria-label="Delete competition" onClick={() => setPending("delete")} />
      {permissions.clearResults && (
        <AnimatedButton icon={Trash2Icon} iconClassName="text-destructive" variant="outline" onClick={() => setPending("clearResults")}>
          Delete results
        </AnimatedButton>
      )}
      {permissions.restart && (
        <AnimatedButton icon={RefreshCCWIcon} variant="outline" onClick={() => setPending("restart")}>
          Restart
        </AnimatedButton>
      )}
      {!locked && (
        <AnimatedButton icon={PlayIcon} disabled={readiness.blocking.length > 0} onClick={() => setPending("start")}>
          Start competition
        </AnimatedButton>
      )}
      {competition.status === "running" && (
        <AnimatedButton
          icon={CircleCheckIcon}
          disabled={readiness.blocking.length > 0}
          title={readiness.blocking.length > 0 ? "Fix the problems listed above first." : undefined}
          onClick={() => setPending("finish")}
        >
          Finish competition
        </AnimatedButton>
      )}
      {competition.status === "finished" && results && (
        <>
          <AnimatedButton icon={RotateCCWIcon} variant="outline" onClick={() => setPending("reopen")}>
            Reopen
          </AnimatedButton>
          {!resultsStale && <ExportButtons setup={setup} results={results} />}
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

      {/* Once started, the setup can still change, so problems (e.g. a set without exercises) are still shown. */}
      {(!locked || (permissions.editSetup && readiness.blocking.length > 0)) && <ReadinessCard readiness={readiness} started={locked} />}

      {/* Keyed by status so the default tab follows the competition into live entry / results. */}
      <Tabs key={competition.status} defaultValue={locked ? "results" : speedFit ? "categories" : "stations"}>
        <TabsList className="mb-4">
          {locked && <TabsTrigger value="results">{competition.status === "finished" ? "Results" : speedFit ? "Timing" : "Scoring"}</TabsTrigger>}
          {!speedFit && (
            <TabsTrigger value="stations">
              Stations ({stationSets.length === 1 ? stationSets[0]!.stations.length : `${stationSets.length} sets`})
            </TabsTrigger>
          )}
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="athletes">Athletes ({new Set(entries.flatMap((e) => e.members.map((m) => m.athleteId))).size})</TabsTrigger>
        </TabsList>
        {locked && results && (
          <TabsContent value="results">
            <ResultsPanel setup={setup} results={results} editable={permissions.enterResults} />
          </TabsContent>
        )}
        {!speedFit && (
          <TabsContent value="stations">
            <StationsPanel setup={setup} locked={!permissions.editSetup} started={locked} />
          </TabsContent>
        )}
        <TabsContent value="categories">
          <CategoriesPanel setup={setup} permissions={permissions} entryIdsWithResults={entryIdsWithResults} />
        </TabsContent>
        <TabsContent value="athletes">
          <EntriesPanel setup={setup} permissions={permissions} entryIdsWithResults={entryIdsWithResults} />
        </TabsContent>
      </Tabs>

      <CompetitionFormDialog competition={competition} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={pending === "start"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Start the competition?"
        description={`${resultNoun[0]!.toUpperCase()}${resultNoun.slice(1)} entry opens. The competition details are locked; ${speedFit ? "categories" : "stations, station sets, categories"} and athletes can still be changed until it's finished.`}
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
        description={`Entry opens again so ${resultNoun}s can be corrected, and the setup can be changed again.`}
        confirmLabel="Reopen"
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "running" })}
      />
      <ConfirmDialog
        open={pending === "clearResults"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete all results?"
        description={`Every ${resultNoun} recorded in this competition is deleted, e.g. after a trial run. The competition keeps running, with its stations, categories and athletes.`}
        confirmLabel="Delete results"
        destructive
        onConfirm={() => clearResults.mutate(competition)}
      />
      <ConfirmDialog
        open={pending === "restart"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Restart the competition?"
        description={`Every ${resultNoun} recorded is deleted and late-entry marks are cleared. ${speedFit ? "Categories" : "Stations, categories"} and athletes are kept. The competition goes back to setup, so it has to be started again.`}
        confirmLabel="Restart"
        destructive
        onConfirm={() => setStatus.mutate({ id: competition.id, status: "draft" })}
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
