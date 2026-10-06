import type { LoadedImage } from "@/lib/images";

/** What goes in one corner of the PDF header. */
export type LogoChoice = { type: "ifbb" } | { type: "none" } | { type: "custom"; image: LoadedImage };

export interface PdfLogos {
  left: LogoChoice;
  right: LogoChoice;
}

/** The default: the IFBB logo on the left, nothing on the right. */
export const DEFAULT_LOGOS: PdfLogos = { left: { type: "ifbb" }, right: { type: "none" } };

/** Intrinsic width / height of src/assets/ifbb-logo.png. */
export const IFBB_LOGO_ASPECT = 610 / 503;

const STORAGE_KEY = "pdf-logos";

/** The logos picked last time (custom ones included), so a federation's logo is picked only once. */
export function rememberedLogos(): PdfLogos {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as PdfLogos | null;
    return saved?.left && saved?.right ? saved : DEFAULT_LOGOS;
  } catch {
    return DEFAULT_LOGOS;
  }
}

export function rememberLogos(logos: PdfLogos): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logos));
  } catch {
    // Storage full or unavailable: the choice just isn't remembered.
  }
}
