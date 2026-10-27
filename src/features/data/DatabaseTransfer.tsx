import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/icons/download";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { exportDatabase, importDatabase, pickDatabaseFile } from "@/db/backup";
import { errorMessage } from "@/lib/errors";

/** Export / import the whole database, e.g. to move everything to another computer. */
export function DatabaseTransfer() {
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  async function runExport() {
    setBusy(true);
    try {
      if (await exportDatabase()) toast.success("Database exported. Import that file on the other computer.");
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function chooseImport() {
    try {
      setImporting(await pickDatabaseFile());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function runImport(source: string) {
    setBusy(true);
    try {
      await importDatabase(source); // reloads the app on success
    } catch (error) {
      toast.error(`Import failed: ${errorMessage(error)}`);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <AnimatedButton icon={DownloadIcon} variant="outline" size="sm" className="justify-start" disabled={busy} onClick={() => void runExport()}>
        Export database
      </AnimatedButton>
      <Button variant="ghost" size="sm" className="justify-start" disabled={busy} onClick={() => void chooseImport()}>
        <Upload /> Import database
      </Button>
      <ConfirmDialog
        open={importing !== null}
        onOpenChange={(open) => !open && setImporting(null)}
        title="Import this database?"
        description={`All data in the app (athletes, categories, exercises, competitions and results) will be replaced by "${importing?.split(/[\\/]/).pop() ?? ""}". A dated copy of the current data is saved to the backups folder first.`}
        confirmLabel="Import and replace"
        destructive
        onConfirm={() => importing && void runImport(importing)}
      />
    </div>
  );
}
