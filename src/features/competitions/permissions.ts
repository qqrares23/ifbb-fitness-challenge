import type { CompetitionStatus } from "@/db/competitions";

/**
 * What the screens offer in each competition state. The database triggers (migrations 0002,
 * 0005, 0010 and 0013) have the final say; this mirrors them so the UI never offers an action that
 * would fail.
 */
export interface CompetitionPermissions {
  /** Name, date and location: only before the start. */
  editDetails: boolean;
  /** Station sets, stations, categories and athletes: until the competition is finished. */
  editSetup: boolean;
  enterResults: boolean;
  /** Delete every result but keep running (e.g. after a trial run). */
  clearResults: boolean;
  /** Back to draft: results are deleted, the setup is kept (0013). */
  restart: boolean;
}

export function competitionPermissions(status: CompetitionStatus): CompetitionPermissions {
  return {
    editDetails: status === "draft",
    editSetup: status !== "finished",
    enterResults: status === "running",
    clearResults: status === "running",
    restart: status !== "draft",
  };
}

/** Once an athlete has results they stay in their category, or those results would move with them. */
export function canChangeCategory(permissions: CompetitionPermissions, hasResults: boolean): boolean {
  return permissions.editSetup && !hasResults;
}
