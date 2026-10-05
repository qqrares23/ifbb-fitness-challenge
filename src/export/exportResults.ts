import type { CompetitionSetup } from "@/db/competitions";
import type { CategoryStandings } from "@/features/competitions/standings";
import { standingsCsv } from "./csv";
import { standingsPdf } from "./pdf";
import { saveFile } from "./saveFile";
import { exportFileStem } from "./standingsTable";

export type ExportFormat = "pdf" | "csv";

/** Entry point of the export module — import it lazily so jsPDF and the fonts load only when needed. */
export async function exportResults(format: ExportFormat, setup: CompetitionSetup, standings: readonly CategoryStandings[]): Promise<boolean> {
  const defaultName = exportFileStem(setup.competition.name);
  return format === "pdf"
    ? saveFile({ defaultName, typeName: "PDF document", extension: "pdf", contents: standingsPdf(setup, standings) })
    : saveFile({ defaultName, typeName: "CSV spreadsheet", extension: "csv", contents: new TextEncoder().encode(standingsCsv(setup, standings)) });
}
