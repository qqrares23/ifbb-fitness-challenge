import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "@/components/icons/download";
import { FileTextIcon } from "@/components/icons/file-text";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import type { CompetitionSetup } from "@/db/competitions";
import type { ExportFormat } from "@/export/exportResults";
import { DEFAULT_LOGOS, type PdfLogos } from "@/export/logos";
import { errorMessage } from "@/lib/errors";
import type { CompetitionResults } from "../standings";
import { PdfLogoDialog } from "./PdfLogoDialog";

interface ExportButtonsProps {
  setup: CompetitionSetup;
  results: CompetitionResults;
}

export function ExportButtons({ setup, results }: ExportButtonsProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [choosingLogos, setChoosingLogos] = useState(false);

  async function run(format: ExportFormat, logos: PdfLogos = DEFAULT_LOGOS) {
    setBusy(format);
    try {
      const { exportResults } = await import("@/export/exportResults");
      if (await exportResults(format, setup, results, logos)) toast.success(`Results saved as ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AnimatedButton icon={DownloadIcon} variant="outline" disabled={busy !== null} onClick={() => run("csv")}>
        {busy === "csv" ? "Exporting…" : "Export CSV"}
      </AnimatedButton>
      <AnimatedButton icon={FileTextIcon} disabled={busy !== null} onClick={() => setChoosingLogos(true)}>
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </AnimatedButton>
      <PdfLogoDialog
        open={choosingLogos}
        onOpenChange={setChoosingLogos}
        onExport={(logos) => {
          setChoosingLogos(false);
          void run("pdf", logos);
        }}
      />
    </>
  );
}
