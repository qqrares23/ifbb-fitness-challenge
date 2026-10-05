import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import { describeCategoryRules } from "@/lib/labels";
import { leaderboardRows, type CompetitionResults } from "../standings";
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
  // Both challenge types share these fields; widening the union lets one tab bar serve both.
  const categories: { category: Category; missingResults: number; rows: unknown[] }[] = results.categories;
  const index = Math.max(0, categories.findIndex((c) => c.category.id === categoryId));
  const current = categories[index];
  if (!current) return null;

  const speedFit = results.kind === "speed_fit";
  const expected = current.rows.length * (speedFit ? 1 : setup.stations.length);
  const rows = leaderboardRows(results, index);

  return (
    <div className="grid gap-4">
      <Tabs value={String(current.category.id)} onValueChange={(value) => setCategoryId(Number(value))}>
        <TabsList variant="line" className="h-auto flex-wrap justify-start">
          {categories.map(({ category, missingResults }) => (
            <TabsTrigger key={category.id} value={String(category.id)} className="flex-none">
              {category.name}
              {missingResults > 0 && <span className="text-xs text-muted-foreground">({missingResults} missing)</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        {describeCategoryRules(current.category)} · {current.rows.length} athletes · {expected - current.missingResults} of {expected}{" "}
        {speedFit ? "times" : "station results"} recorded
      </p>

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
    </div>
  );
}
