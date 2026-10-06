import type { CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { resultsCsv } from "./csv";
import type { PdfLogos } from "./logos";
import { resultsPdf } from "./pdf";
import { saveFile } from "./saveFile";
import { exportFileStem } from "./standingsTable";

export type ExportFormat = "pdf" | "csv";

/** Entry point of the export module — import it lazily so jsPDF and the fonts load only when needed. */
export async function exportResults(format: ExportFormat, setup: CompetitionSetup, results: CompetitionResults, logos: PdfLogos): Promise<boolean> {
  const defaultName = exportFileStem(setup.competition.name);
  return format === "pdf"
    ? saveFile({ defaultName, typeName: "PDF document", extension: "pdf", contents: resultsPdf(setup, results, logos) })
    : saveFile({ defaultName, typeName: "CSV spreadsheet", extension: "csv", contents: new TextEncoder().encode(resultsCsv(results)) });
}
