import type { CSSProperties } from "react";

// Motion only uses opacity and transform, which the browser animates off the main thread.
// The OS "reduce motion" setting turns all of it off (see index.css).

/** Entrance of a list row; combine with `staggerStyle` for a cascading reveal. */
export const ROW_ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 ease-out";

/** Staggers only the first rows, so a long list never waits on its own animation. */
export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 12) * 25}ms` };
}
