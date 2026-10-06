import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { UserPlusIcon } from "@/components/icons/user-plus";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { describeCategoryRules } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { AddEntriesDialog } from "../detail/AddEntriesDialog";
import { groupBySubgroup, leaderboardRows, type CompetitionResults } from "../standings";
import { Leaderboard } from "./Leaderboard";
import { RepsGrid } from "./RepsGrid";
import { TimesTable } from "./TimesTable";
import { WinnerBanner } from "./WinnerBanner";

interface ResultsPanelProps {
  setup: CompetitionSetup;
  results: CompetitionResults;
  /** Results can be typed only while the competition is running. */
  editable: boolean;
}

/** Live entry + standings for either challenge type, one category at a time. */
export function ResultsPanel({ setup, results, editable }: ResultsPanelProps) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [enteringLate, setEnteringLate] = useState(false);
  // Both challenge types share these fields; widening the union lets one tab bar serve both.
  const categories: { category: Category; missingResults: number; rows: unknown[] }[] = results.categories;
  const index = Math.max(0, categories.findIndex((c) => c.category.id === categoryId));
  const current = categories[index];
  if (!current) return null;

  const speedFit = results.kind === "speed_fit";
  const expected = current.rows.length * (speedFit ? 1 : setup.stations.length);
  const rows = leaderboardRows(results, index);

  // Sub-group → level navigation, so officials can move on as soon as a category is done.
  const subgroups = groupBySubgroup(categories.map((c) => c.category));
  const currentSubgroup = subgroups.find((g) => g.categoryIndexes.includes(index))!;
  const isDone = (i: number) => categories[i]!.rows.length > 0 && categories[i]!.missingResults === 0;
  const subgroupDone = (indexes: number[]) => indexes.some((i) => categories[i]!.rows.length > 0) && indexes.every((i) => isDone(i) || categories[i]!.rows.length === 0);
  const goTo = (i: number) => setCategoryId(categories[i]!.category.id);
  const previous = categories[index - 1];
  const next = categories[index + 1];
  const currentDone = isDone(index);

  function openSubgroup(key: string) {
    const indexes = subgroups.find((g) => g.key === key)!.categoryIndexes;
    // Land on the first level still waiting for results.
    goTo(indexes.find((i) => !isDone(i) && categories[i]!.rows.length > 0) ?? indexes[0]!);
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
        {current.category.level ? (
          <Tabs value={String(current.category.id)} onValueChange={(value) => setCategoryId(Number(value))}>
            <TabsList className="h-auto flex-wrap">
              {currentSubgroup.categoryIndexes.map((i) => {
                const { category, missingResults } = categories[i]!;
                return (
                  <TabsTrigger key={category.id} value={String(category.id)} className="flex-none px-3">
                    {isDone(i) && <CircleCheck className="text-emerald-600" />}
                    {category.level}
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
          {describeCategoryRules(current.category)} · {current.rows.length} athletes · {expected - current.missingResults} of {expected}{" "}
          {speedFit ? "times" : "station results"} recorded
        </p>
        {/* Spotting a missed athlete happens here, mid-competition, so entering them is one click away. */}
        {editable && (
          <AnimatedButton icon={UserPlusIcon} variant="outline" size="sm" onClick={() => setEnteringLate(true)}>
            Enter athlete
          </AnimatedButton>
        )}
      </div>

      {current.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No athletes in this category.</p>
      ) : (
        // Keyed by category so switching tabs plays the entrance animation.
        <div key={current.category.id} className="grid animate-in gap-4 fade-in-0 slide-in-from-bottom-2 duration-300">
          <WinnerBanner rows={rows} finished={setup.competition.status === "finished"} />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {results.kind === "speed_fit" ? (
              <TimesTable competitionId={setup.competition.id} standings={results.categories[index]!} editable={editable} />
            ) : (
              <RepsGrid competitionId={setup.competition.id} stations={setup.stations} standings={results.categories[index]!} editable={editable} />
            )}
            <Leaderboard rows={rows} valueLabel={speedFit ? "Time" : "Total reps"} />
          </div>
        </div>
      )}

      <AddEntriesDialog setup={setup} open={enteringLate} onOpenChange={setEnteringLate} initialCategoryId={current.category.id} />
    </div>
  );
}
