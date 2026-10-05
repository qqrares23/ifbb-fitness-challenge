import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CompetitionSetup } from "@/db/competitions";
import { describeCategoryRules } from "@/lib/labels";
import type { CategoryStandings } from "../standings";
import { Leaderboard } from "./Leaderboard";
import { RepsGrid } from "./RepsGrid";

interface ScoringPanelProps {
  setup: CompetitionSetup;
  standings: CategoryStandings[];
  /** Reps can be typed only while the competition is running. */
  editable: boolean;
}

export function ScoringPanel({ setup, standings, editable }: ScoringPanelProps) {
  const [categoryId, setCategoryId] = useState(standings[0]?.category.id ?? 0);
  const current = standings.find((s) => s.category.id === categoryId) ?? standings[0];
  if (!current) return null;

  const resultCount = current.rows.length * setup.stations.length;

  return (
    <div className="grid gap-4">
      <Tabs value={String(current.category.id)} onValueChange={(value) => setCategoryId(Number(value))}>
        <TabsList variant="line" className="h-auto flex-wrap justify-start">
          {standings.map(({ category, missingResults }) => (
            <TabsTrigger key={category.id} value={String(category.id)} className="flex-none">
              {category.name}
              {missingResults > 0 && <span className="text-xs text-muted-foreground">({missingResults} missing)</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        {describeCategoryRules(current.category)} · {current.rows.length} athletes · {resultCount - current.missingResults} of {resultCount} results recorded
      </p>

      {current.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">No athletes in this category.</p>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <RepsGrid competitionId={setup.competition.id} stations={setup.stations} standings={current} editable={editable} />
          <Leaderboard standings={current} />
        </div>
      )}
    </div>
  );
}
