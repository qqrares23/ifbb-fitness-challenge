import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { formatDate } from "@/lib/dates";
import { COMPETITION_KIND_LABELS, describeCategoryRules } from "@/lib/labels";
import { drawLogo, PDF_FONT, useUnicodeFont } from "./pdfAssets";
import { resultsTables } from "./standingsTable";

const MARGIN = 14;
const INK: [number, number, number] = [17, 24, 39];
const MUTED = 100;
const PODIUM_FILLS: [number, number, number][] = [
  [253, 230, 138], // gold
  [226, 232, 240], // silver
  [254, 215, 170], // bronze
];

type DocWithLastTable = jsPDF & { lastAutoTable: { finalY: number } };

/** Official results: IFBB header, then one table per category. Landscape, so many stations still fit. */
export function resultsPdf(setup: CompetitionSetup, results: CompetitionResults): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }) as DocWithLastTable;
  useUnicodeFont(doc);
  const pageHeight = doc.internal.pageSize.getHeight();
  const { competition } = setup;

  const textX = MARGIN + drawLogo(doc, MARGIN, 10, 22) + 6;
  doc.setFont(PDF_FONT, "bold").setFontSize(18).setTextColor(...INK).text(competition.name, textX, 18);
  doc
    .setFont(PDF_FONT, "normal")
    .setFontSize(10)
    .setTextColor(MUTED)
    .text([formatDate(competition.date), competition.location].filter(Boolean).join(" · "), textX, 25)
    .text(`${COMPETITION_KIND_LABELS[competition.kind]} — Official results`, textX, 30);

  const { head, categories } = resultsTables(setup, results, {
    stationHeader: (s) => `S${s.stationNumber}\n${s.exerciseName ?? ""}`,
    missing: "—",
  });
  const nameColumn = 1;
  const placementColumn = head.length - 1;

  let y = 44;
  for (const { category, body } of categories) {
    // Keep a category heading together with at least the start of its table.
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFont(PDF_FONT, "bold").setFontSize(12).setTextColor(...INK).text(category.name, MARGIN, y);
    const nameWidth = doc.getTextWidth(category.name);
    doc.setFont(PDF_FONT, "normal").setFontSize(9).setTextColor(MUTED).text(describeCategoryRules(category), MARGIN + nameWidth + 4, y);

    if (body.length === 0) {
      doc.text("No athletes.", MARGIN, y + 6);
      y += 16;
      continue;
    }

    autoTable(doc, {
      startY: y + 3,
      head: [head],
      body,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, cellPadding: 2, halign: "center", valign: "middle", textColor: INK },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 246, 247] },
      columnStyles: {
        // Fixed widths so every category's table lines up; the remaining columns share the rest.
        0: { cellWidth: 16 },
        [nameColumn]: { cellWidth: 62 },
        2: { cellWidth: 20 },
        [placementColumn]: { cellWidth: 22, fontStyle: "bold" },
      },
      didParseCell: ({ section, column, cell }) => {
        if (column.index === nameColumn) cell.styles.halign = "left";
        if (section === "body" && column.index === placementColumn) {
          const podium = PODIUM_FILLS[Number(cell.raw) - 1];
          if (podium) cell.styles.fillColor = podium;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  const generated = `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont(PDF_FONT, "normal").setFontSize(8).setTextColor(MUTED);
    doc.text(generated, MARGIN, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - MARGIN, pageHeight - 8, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
