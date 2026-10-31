import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { todayIso } from "@/lib/dates";
import { db, replaceDatabaseFile } from "./client";

// Moving all data between computers: the whole SQLite file is exported / imported. The file work
// is done by Rust commands (src-tauri/src/lib.rs), which know where the database lives.

const FILTERS = [{ name: "Fitness Challenge database", extensions: ["db"] }];

/** Saves a copy of the whole database where the user picks. Resolves false if cancelled. */
export async function exportDatabase(): Promise<boolean> {
  const destination = await save({ defaultPath: `fitness-challenge-${todayIso()}.db`, filters: FILTERS });
  if (!destination) return false;
  // VACUUM INTO writes a complete, consistent copy (including anything still in the write-ahead
  // log, even while another connection is reading) to a fresh file, which then replaces the target.
  const partial = await invoke<string>("prepare_export", { destination });
  try {
    await (await db()).execute("VACUUM INTO $1", [partial]);
    await invoke("finish_export", { destination });
  } catch (error) {
    await invoke("prepare_export", { destination }).catch(() => undefined); // clears the half-written copy
    throw error;
  }
  return true;
}

/** Asks for a database file to import; null if cancelled. */
export async function pickDatabaseFile(): Promise<string | null> {
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  return typeof path === "string" ? path : null;
}

/**
 * Replaces all data with the database at `source` (the current one is kept as a backup), then
 * reloads the app, which opens it and runs any migrations an older export still needs.
 * If the file is rejected nothing changes, and the connection reopens on the next query.
 */
export function importDatabase(source: string): Promise<void> {
  return replaceDatabaseFile(() => invoke("import_database", { source })); // it makes a dated backup of the current data first
}

export function hasDatabaseBackup(): Promise<boolean> {
  return invoke<boolean>("has_database_backup");
}

/** The database opened, so an import before this worked and has nothing left to undo. */
export const discardDatabaseBackup = () => invoke<void>("discard_database_backup");

// Automatic backups (src-tauri/src/backup.rs): dated copies on the Desktop, optionally also in a
// folder that Google Drive for desktop uploads.

export interface BackupStatus {
  /** Desktop folder the copies go to. */
  folder: string;
  /** Second folder every copy also goes to, if set up. */
  cloudFolder: string | null;
  /** The Google Drive set-up guide was closed once (it opens by itself until then). */
  guideSeen: boolean;
  /** File name of the newest backup. */
  latest: string | null;
}

export const backupStatus = () => invoke<BackupStatus>("backup_status");
export const backupNow = () => invoke<BackupStatus>("backup_now");
export const setCloudBackupFolder = (folder: string | null) => invoke<BackupStatus>("set_cloud_backup_folder", { folder });
export const markBackupGuideSeen = () => invoke<void>("mark_backup_guide_seen");

/** Asks for a folder; null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const path = await open({ multiple: false, directory: true });
  return typeof path === "string" ? path : null;
}

/** Puts back the database from before the last import, then reloads. */
export function restoreDatabaseBackup(): Promise<void> {
  return replaceDatabaseFile(() => invoke("restore_database_backup"));
}
