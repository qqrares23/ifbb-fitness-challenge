import type { jsPDF } from "jspdf";
// `?inline` bundles these as data URLs, so the PDF needs no network or file access at all.
// This module is only reached through the lazily loaded PDF exporter, so they stay out of the startup bundle.
import notoSansBold from "@/assets/fonts/NotoSans-Bold.ttf?inline";
import notoSansRegular from "@/assets/fonts/NotoSans-Regular.ttf?inline";
import ifbbLogo from "@/assets/ifbb-logo.png?inline";
import { IFBB_LOGO_ASPECT, type LogoChoice } from "./logos";

export const PDF_FONT = "NotoSans";

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

/**
 * Draws a header logo `height` mm tall at y, its left edge at x (or its right edge, for
 * align "right"), keeping its proportions; very wide logos are capped at `maxWidth`.
 * Returns the width used (0 when there's no logo).
 */
export function drawLogo(doc: jsPDF, logo: LogoChoice, x: number, y: number, height: number, align: "left" | "right", maxWidth = 55): number {
  if (logo.type === "none") return 0;
  const { dataUrl, aspect } = logo.type === "ifbb" ? { dataUrl: ifbbLogo, aspect: IFBB_LOGO_ASPECT } : logo.image;
  const width = Math.min(height * aspect, maxWidth);
  const scaledHeight = width / aspect;
  const left = align === "left" ? x : x - width;
  doc.addImage(dataUrl, dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG", left, y + (height - scaledHeight) / 2, width, scaledHeight);
  return width;
}
