import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "@/components/icons/download";
import { FileTextIcon } from "@/components/icons/file-text";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import type { CompetitionSetup } from "@/db/competitions";
import type { PlacementGrouping } from "@/export/lists";
import { DEFAULT_LOGOS, type PdfLogos } from "@/export/logos";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CompetitionResults } from "../standings";
import { PdfLogoDialog } from "./PdfLogoDialog";

interface ExportButtonsProps {
  setup: CompetitionSetup;
  results: CompetitionResults;
}

type ExportModule = typeof import("@/export/exportResults");
type Busy = "csv" | "pdf" | "placement" | null;

/**
 * Runs an export from the lazily loaded export module (jsPDF and the fonts load only when needed)
 * and reports how it went. `label` names the file in the toast, e.g. "Results PDF saved."
 */
export async function runExport(label: string, work: (module: ExportModule) => Promise<boolean>): Promise<void> {
  try {
    if (await work(await import("@/export/exportResults"))) toast.success(`${label} saved.`);
  } catch (error) {
    toast.error(`Export failed: ${errorMessage(error)}`);
  }
}

export function ExportButtons({ setup, results }: ExportButtonsProps) {
  const [busy, setBusy] = useState<Busy>(null);
  // Kept while the dialog closes, so its title and choices don't change during the close animation.
  const [dialog, setDialog] = useState<"pdf" | "placement">("pdf");
  const [choosing, setChoosing] = useState(false);
  const [grouping, setGrouping] = useState<PlacementGrouping>("country");

  async function run(kind: Exclude<Busy, null>, label: string, work: (module: ExportModule) => Promise<boolean>) {
    setBusy(kind);
    await runExport(label, work);
    setBusy(null);
  }

  function choose(kind: "pdf" | "placement") {
    setDialog(kind);
    setChoosing(true);
  }

  function exportPdf(logos: PdfLogos) {
    setChoosing(false);
    if (dialog === "pdf") void run("pdf", "Results PDF", (m) => m.exportResults("pdf", setup, results, logos));
    else void run("placement", `Placement by ${grouping}`, (m) => m.exportPlacement(setup, results, grouping, logos));
  }

  return (
    <>
      <AnimatedButton icon={DownloadIcon} variant="outline" disabled={busy !== null} onClick={() => void run("csv", "Results CSV", (m) => m.exportResults("csv", setup, results, DEFAULT_LOGOS))}>
        {busy === "csv" ? "Exporting…" : "Export CSV"}
      </AnimatedButton>
      <AnimatedButton icon={FileTextIcon} variant="outline" disabled={busy !== null} onClick={() => choose("placement")}>
        {busy === "placement" ? "Exporting…" : "Placement PDF"}
      </AnimatedButton>
      <AnimatedButton icon={FileTextIcon} disabled={busy !== null} onClick={() => choose("pdf")}>
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </AnimatedButton>
      <PdfLogoDialog
        open={choosing}
        onOpenChange={setChoosing}
        title={dialog === "placement" ? "Placement by country or club" : "Results PDF"}
        onExport={exportPdf}
      >
        {dialog === "placement" && (
          <div className="grid gap-2">
            <div role="radiogroup" aria-label="Rank by" className="inline-flex justify-self-start rounded-lg border p-0.5">
              {(["country", "club"] as const).map((by) => (
                <button
                  key={by}
                  type="button"
                  role="radio"
                  aria-checked={grouping === by}
                  onClick={() => setGrouping(by)}
                  className={cn("rounded-md px-4 py-1.5 text-sm transition-colors", grouping === by ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  By {by}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {grouping === "country" ? "Countries" : "Clubs"} are ranked by their 1st places across every category, then 2nd, then 3rd.
              {grouping === "club" && " Athletes without a club, and IFBB Fitness Challenge categories, aren't counted."}
            </p>
          </div>
        )}
      </PdfLogoDialog>
    </>
  );
}
