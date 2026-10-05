import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry } from "@/db/entries";
import { rankCategory, type RankedRow, type RepScore } from "@/engine";

export interface CategoryStandings {
  category: Category;
  rows: RankedRow<Entry>[];
  /** Station results still missing across the category. */
  missingResults: number;
}

/**
 * The one place a competition gets ranked: the scoring screen, the results view and every
 * export read from this, so they can never disagree. Ties are listed by bib number.
 */
export function competitionStandings(setup: CompetitionSetup, scores: readonly RepScore[]): CategoryStandings[] {
  const stationNumbers = setup.stations.map((s) => s.stationNumber);
  return setup.categories.map((category) => {
    const entries = setup.entries.filter((e) => e.categoryId === category.id).sort((a, b) => a.bibNumber - b.bibNumber);
    const rows = rankCategory(entries, stationNumbers, scores);
    const missingResults = rows.reduce((sum, row) => sum + [...row.perStation.values()].filter((reps) => reps === null).length, 0);
    return { category, rows, missingResults };
  });
}
