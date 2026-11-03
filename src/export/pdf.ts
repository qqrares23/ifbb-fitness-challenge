import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import type { Competition, CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { formatDateRange } from "@/lib/dates";
import { categorySubtitle } from "@/lib/labels";
import type { PdfLogos } from "./logos";
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

/** A new A4 document with the embedded font. */
export function newPdf(orientation: "portrait" | "landscape"): jsPDF {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  useUnicodeFont(doc);
  return doc;
}

const MM_PER_PT = 25.4 / 72;

/** `text` in at most `width` mm: the font shrinks from `size` down to `minSize`, then the text wraps. Leaves the font size set. */
function fitLines(doc: jsPDF, text: string, width: number, size: number, minSize: number): string[] {
  while (size > minSize && doc.setFontSize(size).getTextWidth(text) > width) size--;
  return doc.setFontSize(size).splitTextToSize(text, width) as string[];
}

/**
 * The header every PDF of the app starts a section with: logos, competition name, dates · location,
 * and `subtitle`, all kept clear of the logos. Returns where the content below it starts (40 mm
 * unless a long name had to wrap).
 */
export function drawHeader(doc: jsPDF, competition: Competition, logos: PdfLogos, subtitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoWidth = Math.max(drawLogo(doc, logos.left, MARGIN, 10, 22, "left"), drawLogo(doc, logos.right, pageWidth - MARGIN, 10, 22, "right"));
  // Same space on both sides, so the text stays centred on the page.
  const textWidth = pageWidth - 2 * (MARGIN + (logoWidth > 0 ? logoWidth + 4 : 0));
  const centerX = pageWidth / 2;
  const center = { align: "center" } as const;

  let y = 18;
  const write = (text: string, size: number, minSize: number, gap: number) => {
    const lines = fitLines(doc, text, textWidth, size, minSize);
    const lineHeight = doc.getFontSize() * MM_PER_PT * 1.15;
    doc.text(lines, centerX, y, { ...center, lineHeightFactor: 1.15 });
    y += (lines.length - 1) * lineHeight + gap;
  };
  doc.setFont(PDF_FONT, "bold").setTextColor(...INK);
  write(competition.name, 18, 12, 7);
  doc.setTextColor(MUTED);
  write([formatDateRange(competition.date, competition.endDate), competition.location].filter(Boolean).join(" · "), 10, 8, 5);
  write(subtitle, 10, 8, 10);
  return Math.max(y, 40);
}

/** "Page x of y" at the bottom right of every page, then the file's bytes. */
export function finishPdf(doc: jsPDF): Uint8Array {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont(PDF_FONT, "normal").setFontSize(8).setTextColor(MUTED);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

/** Table styles shared by every PDF. */
export const TABLE_STYLES = {
  margin: { left: MARGIN, right: MARGIN },
  styles: { fontSize: 9, cellPadding: 2, halign: "center", valign: "middle", textColor: INK },
  headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
  alternateRowStyles: { fillColor: [246, 246, 247] },
} satisfies Partial<UserOptions>;

export { MARGIN, MUTED, PODIUM_FILLS };

/**
 * Official results: one page per category (a long one continues onto the next pages), each with
 * a header naming the category once ("Fitness Challenge — Junior Men 14–23 Gold Level Official
 * Results") between the chosen logos. Landscape, so many stations still fit.
 */
export function resultsPdf(setup: CompetitionSetup, results: CompetitionResults, logos: PdfLogos): Uint8Array {
  const doc = newPdf("landscape");
  const { competition } = setup;


  const tables = resultsTables(results, {
    stationHeader: (s) => `S${s.stationNumber}\n${s.exerciseName ?? ""}`,
    missing: "—",
  });
  const nameColumn = 1;

  for (const [index, { category, part, head, body }] of tables.entries()) {
    // Columns differ per category: each uses its own station set.
    const placementColumn = head.length - 1;
    // Fixed widths so every category's table lines up; the station columns share the rest.
    const columnStyles: Record<number, { cellWidth?: number; fontStyle?: "bold" }> = {
      0: { cellWidth: 16 },
      [nameColumn]: { cellWidth: 62 },
      2: { cellWidth: 20 },
      [placementColumn - 1]: { cellWidth: results.kind === "speed_fit" ? 26 : 18, fontStyle: "bold" },
      [placementColumn]: { cellWidth: 22, fontStyle: "bold" },
    };
    let side = MARGIN;
    if (results.kind === "speed_fit") {
      // No station columns to fill the page, so the (fixed width) table is centred instead.
      if (head.length > 5) columnStyles[3] = { cellWidth: 50 }; // Club
      const width = head.reduce((sum, _, i) => sum + (columnStyles[i]?.cellWidth ?? 0), 0);
      side = (doc.internal.pageSize.getWidth() - width) / 2;
    }
    if (index > 0) doc.addPage();
    const y = drawHeader(doc, competition, logos, categorySubtitle(competition, category, `${part ? ` · ${part}` : ""} Official Results`));

    if (body.length === 0) {
      doc.setFont(PDF_FONT, "normal").setFontSize(10).setTextColor(MUTED).text("No athletes.", MARGIN, y + 4);
      continue;
    }

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      ...TABLE_STYLES,
      margin: { left: side, right: side },
      columnStyles,
      didParseCell: ({ section, column, cell }) => {
        if (column.index === nameColumn) cell.styles.halign = "left";
        if (section === "body" && column.index === placementColumn) {
          const podium = PODIUM_FILLS[Number(cell.raw) - 1];
          if (podium) cell.styles.fillColor = podium;
        }
      },
    });
  }

  return finishPdf(doc);
}
