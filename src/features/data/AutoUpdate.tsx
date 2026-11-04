import { useEffect } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import { backupNow } from "@/db/backup";
import { hasRunningCompetition } from "@/db/competitions";
import { errorMessage } from "@/lib/errors";

/** Once per app start (StrictMode runs effects twice in development). */
let checked = false;

/**
 * Installs a newer version as the app starts: it asks GitHub (the endpoint in tauri.conf.json)
 * for a signed update, backs up the database, downloads and installs the update and restarts.
 * Offline, the check fails and the app carries on. Skipped while a competition is running (e.g.
 * the app was reopened mid-event), so judging is never interrupted; the next start updates.
 */
async function updateNow() {
  let update;
  try {
    if (await hasRunningCompetition()) return;
    update = await check();
  } catch (error) {
    // Usually just offline; logged so a broken release (bad signature, missing platform) can be traced.
    console.warn("Update check failed:", error);
    return;
  }
  if (!update) return;
  const progress = toast.loading(`Updating to version ${update.version}… The app restarts by itself.`);
  try {
    // The new version may migrate the database, and on Windows the installer closes the app without its exit backup.
    await backupNow();
    await update.downloadAndInstall();
    await relaunch();
  } catch (error) {
    toast.error(`The update couldn't be installed: ${errorMessage(error)}`, { id: progress });
  }
}

export function AutoUpdate() {
  useEffect(() => {
    if (checked) return;
    checked = true;
    void updateNow();
  }, []);
  return null;
}
