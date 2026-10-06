import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { todayIso } from "@/lib/dates";
import { closeDb, db } from "./client";

// Moving all data between computers: the whole SQLite file is exported / imported. The file work
// is done by Rust commands (src-tauri/src/lib.rs), which know where the database lives.

const FILTERS = [{ name: "Fitness Challenge database", extensions: ["db"] }];

/** Saves a copy of the whole database where the user picks. Resolves false if cancelled. */
export async function exportDatabase(): Promise<boolean> {
  const destination = await save({ defaultPath: `fitness-challenge-${todayIso()}.db`, filters: FILTERS });
  if (!destination) return false;
  // Move everything still in the write-ahead log into the main file, so the copy is complete.
  await (await db()).execute("PRAGMA wal_checkpoint(TRUNCATE)");
  await invoke("export_database", { destination });
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
export async function importDatabase(source: string): Promise<void> {
  await closeDb();
  await invoke("import_database", { source });
  window.location.reload();
}

export function hasDatabaseBackup(): Promise<boolean> {
  return invoke<boolean>("has_database_backup");
}

/** Puts back the database from before the last import, then reloads. */
export async function restoreDatabaseBackup(): Promise<void> {
  await closeDb();
  await invoke("restore_database_backup");
  window.location.reload();
}
