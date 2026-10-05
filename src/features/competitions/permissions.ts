import type { CompetitionStatus } from "@/db/competitions";

/**
 * What the screens offer in each competition state. The database triggers (migrations 0002 and
 * 0005) have the final say; this mirrors them so the UI never offers an action that would fail.
 */
export interface CompetitionPermissions {
  /** Stations, category rules and competition details: only before the start. */
  editSetup: boolean;
  /** Adding / removing athletes and changing bibs: also while running (late entries). */
  editEntries: boolean;
  /** Adding categories from the library: also while running, for a late athlete's category. */
  addCategories: boolean;
  enterResults: boolean;
}

export function competitionPermissions(status: CompetitionStatus): CompetitionPermissions {
  return {
    editSetup: status === "draft",
    editEntries: status !== "finished",
    addCategories: status !== "finished",
    enterResults: status === "running",
  };
}

/** A category can be removed before the start, or later while it is still empty. */
export function canRemoveCategory(permissions: CompetitionPermissions, entryCount: number): boolean {
  return permissions.editSetup || (permissions.editEntries && entryCount === 0);
}

/** Once an athlete has results they stay in their category, or those results would move with them. */
export function canChangeCategory(permissions: CompetitionPermissions, hasResults: boolean): boolean {
  return permissions.editEntries && !hasResults;
}
