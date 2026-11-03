import type { CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { resultsCsv } from "./csv";
import type { PlacementGrouping } from "./lists";
import { entryListPdf, placementPdf } from "./listsPdf";
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

/** The entry list (all athletes, then each category's), to print before the start. */
export function exportEntryList(setup: CompetitionSetup, logos: PdfLogos): Promise<boolean> {
  return saveFile({ defaultName: exportFileStem(setup.competition.name, "athletes"), typeName: "PDF document", extension: "pdf", contents: entryListPdf(setup, logos) });
}

/** Countries or clubs ranked by their podium places. */
export function exportPlacement(setup: CompetitionSetup, results: CompetitionResults, by: PlacementGrouping, logos: PdfLogos): Promise<boolean> {
  return saveFile({
    defaultName: exportFileStem(setup.competition.name, `placement-by-${by}`),
    typeName: "PDF document",
    extension: "pdf",
    contents: placementPdf(setup, results, by, logos),
  });
}
