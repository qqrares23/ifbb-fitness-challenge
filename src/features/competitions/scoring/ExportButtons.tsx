import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CompetitionSetup } from "@/db/competitions";
import type { ExportFormat } from "@/export/exportResults";
import { errorMessage } from "@/lib/errors";
import type { CategoryStandings } from "../standings";

interface ExportButtonsProps {
  setup: CompetitionSetup;
  standings: CategoryStandings[];
}

export function ExportButtons({ setup, standings }: ExportButtonsProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    setBusy(format);
    try {
      const { exportResults } = await import("@/export/exportResults");
      if (await exportResults(format, setup, standings)) toast.success(`Results saved as ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" disabled={busy !== null} onClick={() => run("csv")}>
        {busy === "csv" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export CSV
      </Button>
      <Button disabled={busy !== null} onClick={() => run("pdf")}>
        {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} Export PDF
      </Button>
    </>
  );
}
