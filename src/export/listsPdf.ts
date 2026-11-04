import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import type { CompetitionSetup } from "@/db/competitions";
import type { CompetitionResults } from "@/features/competitions/standings";
import { categorySubtitle, competitionTitle } from "@/lib/labels";
import { athleteListTable, categoryEntriesTable, placementTable, type PlacementGrouping } from "./lists";
import type { PdfLogos } from "./logos";
import { drawHeader, finishPdf, MARGIN, MUTED, newPdf, PODIUM_FILLS, TABLE_STYLES } from "./pdf";
import { PDF_FONT } from "./pdfAssets";

/** Where the last table ended (jspdf-autotable stores it on the document but doesn't type it). */
const tableEnd = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/** A muted line under the last table; on the next page when the table ends at the bottom, so it never runs into the page footer. */
function noteBelowTable(doc: jsPDF, fontSize: number, text: string) {
  let y = tableEnd(doc) + 6;
  if (y > doc.internal.pageSize.getHeight() - 14) {
    doc.addPage();
    y = 20;
  }
  doc.setFont(PDF_FONT, "normal").setFontSize(fontSize).setTextColor(MUTED).text(text, MARGIN, y);
}

/**
 * The entry list, for printing before the start: every athlete with their number and categories,
 * then each category's athletes. Portrait A4.
 */
export function entryListPdf(setup: CompetitionSetup, logos: PdfLogos): Uint8Array {
  const doc = newPdf("portrait");
  const { competition, categories, entries } = setup;
  const leftAligned = (columns: number[]) => Object.fromEntries(columns.map((c) => [c, { halign: "left" as const }]));

  const top = drawHeader(doc, competition, logos, competitionTitle(categories, "Athletes"));
  const athletes = athleteListTable(setup);
  if (athletes.body.length === 0) {
    doc.setFont(PDF_FONT, "normal").setFontSize(10).setTextColor(MUTED).text("No athletes entered yet.", MARGIN, top + 4);
  } else {
    const categoriesColumn = athletes.head.length - 1;
    autoTable(doc, {
      ...TABLE_STYLES,
      startY: top,
      head: [athletes.head],
      body: athletes.body,
      columnStyles: { 0: { cellWidth: 14 }, ...leftAligned([1, 4, categoriesColumn]), ...(athletes.head.includes("Club") ? leftAligned([5]) : {}) },
    });
  }

  // Each category on a page of its own, so each can be handed to its officials.
  for (const category of categories) {
    doc.addPage();
    const categoryTop = drawHeader(doc, competition, logos, categorySubtitle(category, ` · ${categoryEntriesTable(category, entries).body.length} Athletes`));
    const table = categoryEntriesTable(category, entries);
    if (table.body.length === 0) {
      doc.setFont(PDF_FONT, "normal").setFontSize(10).setTextColor(MUTED).text("No athletes in this category.", MARGIN, categoryTop + 4);
      continue;
    }
    autoTable(doc, { ...TABLE_STYLES, startY: categoryTop, head: [table.head], body: table.body, columnStyles: { 0: { cellWidth: 16 }, ...leftAligned([1, 2, 3]) } });
  }
  return finishPdf(doc);
}

const GROUPING_LABELS: Record<PlacementGrouping, string> = { country: "Country", club: "Club" };

/** After the finish: countries or clubs ranked by their podium places across all categories. Portrait A4. */
export function placementPdf(setup: CompetitionSetup, results: CompetitionResults, by: PlacementGrouping, logos: PdfLogos): Uint8Array {
  const doc = newPdf("portrait");
  const { competition, categories } = setup;
  const top = drawHeader(doc, competition, logos, competitionTitle(categories, `Placement by ${by}`));

  const rows = placementTable(results, by);
  if (rows.length === 0) {
    const none = by === "club" ? "No athlete has a club." : "No athletes.";
    doc.setFont(PDF_FONT, "normal").setFontSize(10).setTextColor(MUTED).text(none, MARGIN, top + 4);
    return finishPdf(doc);
  }
  autoTable(doc, {
    ...TABLE_STYLES,
    startY: top,
    head: [["Place", GROUPING_LABELS[by], "1st", "2nd", "3rd"]],
    body: rows.map((r) => [String(r.place), r.name, String(r.gold), String(r.silver), String(r.bronze)]),
    columnStyles: { 0: { cellWidth: 18, fontStyle: "bold" }, 1: { halign: "left" }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 } },
    didParseCell: ({ section, column, cell, row }) => {
      if (section !== "body" || column.index !== 0) return;
      const { gold, silver, bronze } = rows[row.index]!;
      // Rows without any podium place share a place too, but get no medal colour.
      const podium = gold + silver + bronze > 0 ? PODIUM_FILLS[Number(cell.raw) - 1] : undefined;
      if (podium) cell.styles.fillColor = podium;
    },
  });
  noteBelowTable(doc, 8, `Ranked by 1st places, then 2nd, then 3rd, across every category. A couple or team counts for each of its ${by === "country" ? "countries" : "clubs"}.`);
  return finishPdf(doc);
}
