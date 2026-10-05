import type { jsPDF } from "jspdf";
// `?inline` bundles these as data URLs, so the PDF needs no network or file access at all.
// This module is only reached through the lazily loaded PDF exporter, so they stay out of the startup bundle.
import notoSansBold from "@/assets/fonts/NotoSans-Bold.ttf?inline";
import notoSansRegular from "@/assets/fonts/NotoSans-Regular.ttf?inline";
import ifbbLogo from "@/assets/ifbb-logo.png?inline";

export const PDF_FONT = "NotoSans";

/** Intrinsic size of src/assets/ifbb-logo.png, for keeping its aspect ratio. */
const LOGO_ASPECT = 395 / 251;

const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/**
 * jsPDF's built-in fonts only cover Western European characters, so names like "Łukasz" or
 * "Şahin" would print with gaps. Embeds Noto Sans and makes it the default for text and tables.
 */
export function useUnicodeFont(doc: jsPDF): void {
  doc.addFileToVFS("NotoSans-Regular.ttf", base64Of(notoSansRegular));
  doc.addFont("NotoSans-Regular.ttf", PDF_FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", base64Of(notoSansBold));
  doc.addFont("NotoSans-Bold.ttf", PDF_FONT, "bold");
  doc.setFont(PDF_FONT, "normal");
  // jspdf-autotable ignores the document font and hardcodes "helvetica"; this field is where
  // its own setDefaults(defaults, doc) stores per-document defaults.
  (doc as unknown as { __autoTableDocumentDefaults: unknown }).__autoTableDocumentDefaults = { styles: { font: PDF_FONT } };
}

/** Draws the IFBB logo with its top-left corner at (x, y), `height` mm tall. Returns its width. */
export function drawLogo(doc: jsPDF, x: number, y: number, height: number): number {
  const width = height * LOGO_ASPECT;
  doc.addImage(ifbbLogo, "PNG", x, y, width, height);
  return width;
}
