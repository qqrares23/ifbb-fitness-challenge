import type { CompetitionStatus } from "@/db/competitions";

/**
 * What the screens offer in each competition state. The database triggers (migrations 0002,
 * 0005 and 0010) have the final say; this mirrors them so the UI never offers an action that
 * would fail.
 */
export interface CompetitionPermissions {
  /** Name, date and location: only before the start. */
  editDetails: boolean;
  /** Station sets, stations, categories and athletes: until the competition is finished. */
  editSetup: boolean;
  enterResults: boolean;
}

export function competitionPermissions(status: CompetitionStatus): CompetitionPermissions {
  return {
    editDetails: status === "draft",
    editSetup: status !== "finished",
    enterResults: status === "running",
  };
}

/** Once an athlete has results they stay in their category, or those results would move with them. */
export function canChangeCategory(permissions: CompetitionPermissions, hasResults: boolean): boolean {
  return permissions.editSetup && !hasResults;
}
