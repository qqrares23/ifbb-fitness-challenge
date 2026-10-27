import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { Cloud, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { backupNow, backupStatus, markBackupGuideSeen, pickFolder, setCloudBackupFolder } from "@/db/backup";
import { useDbMutation } from "@/hooks/useDbMutation";
import { errorMessage } from "@/lib/errors";

const STATUS_KEY = ["backups"];

/** "fitness-challenge-2026-10-27_19-30-05.db" → "2026-10-27 19:30". */
function backupTime(name: string): string {
  const match = /(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})/.exec(name);
  return match ? `${match[1]} ${match[2]}:${match[3]}` : name;
}

/**
 * Automatic backups: where they go, "Back up now", and the Google Drive set-up guide, which
 * opens by itself the first time the app is used.
 */
export function Backups() {
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: backupStatus });
  const [open, setOpen] = useState(false);
  const now = useDbMutation<void>(() => backupNow(), { invalidates: [STATUS_KEY], success: "Backup saved." });
  // Refetched even on failure: the folder is saved before its first copy, which can still fail.
  const setCloud = useDbMutation<string | null>((folder) => setCloudBackupFolder(folder).finally(() => status.refetch()), {
    invalidates: [],
    success: (folder) => (folder ? "Google Drive backups are set up. A first copy is already there." : "Backups are no longer copied to Google Drive."),
  });

  const guideSeen = status.data?.guideSeen;
  useEffect(() => {
    if (guideSeen === false) setOpen(true);
  }, [guideSeen]);

  // Timed backups run in the background; only their failures need the user's attention.
  useEffect(() => {
    const unlisten = listen<string>("backup-failed", (event) => toast.error(`Automatic backup failed: ${event.payload}`));
    return () => void unlisten.then((stop) => stop());
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    // If saving that fails, the guide just opens again next start.
    if (!next && guideSeen === false) void markBackupGuideSeen().then(() => status.refetch(), () => undefined);
  }

  async function chooseCloudFolder() {
    let folder: string | null;
    try {
      folder = await pickFolder();
    } catch (error) {
      toast.error(errorMessage(error));
      return;
    }
    if (folder) setCloud.mutate(folder);
  }

  const data = status.data;
  const busy = now.isPending || setCloud.isPending;

  return (
    <>
      <Button variant="outline" size="sm" className="justify-start" onClick={() => setOpen(true)}>
        <HardDriveDownload /> Backups
        {data?.cloudFolder && <Cloud className="ml-auto text-gold" />}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{guideSeen === false ? "Set up backups" : "Backups"}</DialogTitle>
            <DialogDescription>
              A copy of all data is saved when the app closes, every 30 minutes while it is open (if anything changed) and before
              an import. The newest 30 copies are kept.
            </DialogDescription>
          </DialogHeader>

          <section className="grid gap-1.5 rounded-lg border p-3 text-sm">
            <p className="font-medium">On this computer</p>
            <p className="font-mono text-xs break-all text-muted-foreground select-all">{data?.folder}</p>
            <p className="text-muted-foreground">Last backup: {data?.latest ? backupTime(data.latest) : "none yet"}</p>
          </section>

          <section className="grid gap-2 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Cloud className="size-4" /> Google Drive
            </p>
            {data?.cloudFolder ? (
              <>
                <p className="text-muted-foreground">Every backup is also copied here, and Google Drive uploads it:</p>
                <p className="font-mono text-xs break-all select-all">{data.cloudFolder}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void chooseCloudFolder()}>
                    Change folder
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCloud.mutate(null)}>
                    Stop copying to Google Drive
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">Keep a copy online too, so the data survives if this computer is lost or broken:</p>
                <ol className="ml-5 grid list-decimal gap-1.5 text-muted-foreground">
                  <li>
                    Install <span className="font-medium text-foreground">Google Drive for desktop</span> from{" "}
                    <span className="font-mono text-foreground select-all">google.com/drive/download</span> and sign in with the Google
                    account that should hold the backups.
                  </li>
                  <li>
                    File Explorer now shows a <span className="font-medium text-foreground">Google Drive</span> drive (usually G:) with a{" "}
                    <span className="font-medium text-foreground">My Drive</span> folder in it.
                  </li>
                  <li>
                    Click <span className="font-medium text-foreground">Choose Google Drive folder</span> below and pick{" "}
                    <span className="font-medium text-foreground">My Drive</span>.
                  </li>
                  <li>
                    The app makes an "IFBB Fitness Challenge backups" folder there and copies every backup into it. Google Drive uploads
                    it by itself; check it at <span className="font-mono text-foreground select-all">drive.google.com</span>.
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Only copies go to Google Drive. The database the app works on stays on this computer.
                </p>
                <Button size="sm" className="justify-self-start" disabled={busy} onClick={() => void chooseCloudFolder()}>
                  <Cloud /> Choose Google Drive folder
                </Button>
              </>
            )}
          </section>

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => now.mutate()}>
              Back up now
            </Button>
            <Button onClick={() => changeOpen(false)}>{guideSeen === false && !data?.cloudFolder ? "Later" : "Done"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
