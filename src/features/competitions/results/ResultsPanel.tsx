import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { UserPlusIcon } from "@/components/icons/user-plus";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupBySubgroup } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { describeCategoryRules } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { AddEntriesDialog } from "../detail/AddEntriesDialog";
import type { CompetitionResults, FitnessChallengeStandings } from "../standings";
import { ExpandableTable } from "./ExpandableTable";
import { OverallTable } from "./OverallTable";
import { RepsGrid } from "./RepsGrid";
import { TimesTable } from "./TimesTable";

interface ResultsPanelProps {
  setup: CompetitionSetup;
  results: CompetitionResults;
  /** Results can be typed only while the competition is running. */
  editable: boolean;
}

/** Live result entry for either challenge type, one category at a time; the table itself is the standings. */
export function ResultsPanel({ setup, results, editable }: ResultsPanelProps) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [enteringLate, setEnteringLate] = useState(false);
  // Which ranking of a category with several station sets is shown: a set's id, or "overall".
  const [view, setView] = useState<{ categoryId: number; part: string } | null>(null);
  // A challenge-neutral summary of each category, so one tab bar serves both challenge types.
  const categories = results.categories.map((c) => ({
    category: c.category,
    missingResults: c.missingResults,
    athletes: c.rows.length,
    // Speed Fit: one time per athlete. Fitness Challenge: one result per station of each of the category's sets.
    resultsPerAthlete: "sets" in c ? c.sets.reduce((sum, set) => sum + set.stationSet.stations.length, 0) : 1,
  }));
  const index = Math.max(0, categories.findIndex((c) => c.category.id === categoryId));
  const current = categories[index];
  if (!current) return null;

  const speedFit = results.kind === "speed_fit";
  const expected = current.athletes * current.resultsPerAthlete;

  // Sub-group → level navigation, so officials can move on as soon as a category is done.
  const subgroups = groupBySubgroup(categories.map((c) => c.category));
  const currentSubgroup = subgroups.find((g) => g.categoryIndexes.includes(index))!;
  const isDone = (i: number) => categories[i]!.athletes > 0 && categories[i]!.resultsPerAthlete > 0 && categories[i]!.missingResults === 0;
  const subgroupDone = (indexes: number[]) => indexes.some((i) => categories[i]!.athletes > 0) && indexes.every((i) => isDone(i) || categories[i]!.athletes === 0);
  const goTo = (i: number) => setCategoryId(categories[i]!.category.id);
  const previous = categories[index - 1];
  const next = categories[index + 1];
  const currentDone = isDone(index);

  function openSubgroup(key: string) {
    const indexes = subgroups.find((g) => g.key === key)!.categoryIndexes;
    // Land on the first level still waiting for results.
    goTo(indexes.find((i) => !isDone(i) && categories[i]!.athletes > 0) ?? indexes[0]!);
  }

  return (
    <div className="grid gap-4">
      <Tabs value={currentSubgroup.key} onValueChange={openSubgroup}>
        <TabsList variant="line" className="h-auto flex-wrap justify-start">
          {subgroups.map(({ key, label, categoryIndexes }) => (
            <TabsTrigger key={key} value={key} className="flex-none">
              {subgroupDone(categoryIndexes) && <CircleCheck className="text-emerald-600" />}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {currentSubgroup.categoryIndexes.length > 1 || current.category.level ? (
          <Tabs value={String(current.category.id)} onValueChange={(value) => setCategoryId(Number(value))}>
            <TabsList className="h-auto flex-wrap">
              {currentSubgroup.categoryIndexes.map((i) => {
                const { category, missingResults } = categories[i]!;
                return (
                  <TabsTrigger key={category.id} value={String(category.id)} className="flex-none px-3">
                    {isDone(i) && <CircleCheck className="text-emerald-600" />}
                    {category.level || "No level"}
                    {missingResults > 0 && <span className="text-xs text-muted-foreground">({missingResults} missing)</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!previous} onClick={() => goTo(index - 1)} aria-label="Previous category">
            <ChevronLeft />
          </Button>
          <Button
            variant={currentDone && next ? "default" : "outline"}
            size="sm"
            disabled={!next}
            onClick={() => goTo(index + 1)}
            className={cn(currentDone && next && "animate-in zoom-in-95")}
          >
            {next ? `Next: ${next.category.name}` : "Last category"}
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {currentDone && <span className="mr-1 font-medium text-emerald-700">All results in.</span>}
          {describeCategoryRules(current.category)} · {current.athletes} athletes · {expected - current.missingResults} of {expected}{" "}
          {speedFit ? "times" : "station results"} recorded
        </p>
        {/* Spotting a missed athlete happens here, mid-competition, so entering them is one click away. */}
        {editable && (
          <AnimatedButton icon={UserPlusIcon} variant="outline" size="sm" onClick={() => setEnteringLate(true)}>
            Enter athlete
          </AnimatedButton>
        )}
      </div>

      {current.athletes === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No athletes in this category.</p>
      ) : (
        // Keyed by category so switching tabs plays the entrance animation.
        <div key={current.category.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {results.kind === "speed_fit" ? (
            <ExpandableTable title={current.category.name}>
              <TimesTable competitionId={setup.competition.id} standings={results.categories[index]!} editable={editable} />
            </ExpandableTable>
          ) : (
            <FitnessChallengeTables
              competitionId={setup.competition.id}
              standings={results.categories[index]!}
              editable={editable}
              part={view?.categoryId === current.category.id ? view.part : "0"}
              onPartChange={(part) => setView({ categoryId: current.category.id, part })}
            />
          )}
        </div>
      )}

      <AddEntriesDialog setup={setup} open={enteringLate} onOpenChange={setEnteringLate} initialCategoryId={current.category.id} />
    </div>
  );
}

interface FitnessChallengeTablesProps {
  competitionId: number;
  standings: FitnessChallengeStandings;
  editable: boolean;
  /** A set's id ("0" = the first set), or "overall". */
  part: string;
  onPartChange: (part: string) => void;
}

/** One category's Fitness Challenge tables: its set, or with several sets a tab per set plus Overall. */
function FitnessChallengeTables({ competitionId, standings, editable, part, onPartChange }: FitnessChallengeTablesProps) {
  const { category, sets } = standings;
  if (sets.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Pick a station set for this category in the Categories tab.</p>;
  }
  const overall = sets.length > 1 && part === "overall";
  // Track the set by id, not position, so removing a set while viewing it doesn't desync the tab.
  const set = sets.find((s) => String(s.stationSet.id) === part) ?? sets[0]!;

  return (
    <div className="grid gap-3">
      {sets.length > 1 && (
        <Tabs value={overall ? "overall" : String(set.stationSet.id)} onValueChange={onPartChange}>
          <TabsList className="h-auto flex-wrap">
            {sets.map(({ stationSet, missingResults }) => (
              <TabsTrigger key={stationSet.id} value={String(stationSet.id)} className="flex-none px-3">
                {stationSet.name}
                {missingResults > 0 && <span className="text-xs text-muted-foreground">({missingResults} missing)</span>}
              </TabsTrigger>
            ))}
            <TabsTrigger value="overall" className="flex-none px-3 font-semibold">
              Overall
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <ExpandableTable title={sets.length > 1 ? `${category.name} · ${overall ? "Overall" : set.stationSet.name}` : category.name}>
        {overall ? <OverallTable standings={standings} /> : <RepsGrid key={set.stationSet.id} competitionId={competitionId} set={set} editable={editable} />}
      </ExpandableTable>
    </div>
  );
}
