import { useEffect, useState, type ReactNode } from "react";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && target.closest("input, textarea, button, [role=combobox]") !== null;

/** Puts the app window in or out of full screen; harmless where that isn't available. */
async function setWindowFullscreen(fullscreen: boolean) {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(fullscreen);
  } catch {
    // Not running in Tauri (or not allowed): the in-app overlay still fills the window.
  }
}

/**
 * A results table that a double-click expands to the whole screen (and back), for judges entering
 * results at the side of the stage. The same table stays mounted, so typed values aren't lost.
 */
export function ExpandableTable({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    void setWindowFullscreen(true);
    const onKey = (event: KeyboardEvent) => {
      // Escape inside a field cancels that edit; only Escape elsewhere leaves full screen.
      if (event.key === "Escape" && !isTyping(document.activeElement)) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      void setWindowFullscreen(false);
    };
  }, [expanded]);

  return (
    <div
      onDoubleClick={(event) => !isTyping(event.target) && setExpanded((value) => !value)}
      className={cn(expanded && "fixed inset-0 z-50 flex animate-in flex-col overflow-auto bg-background p-6 fade-in-0 zoom-in-95 duration-200")}
    >
      {expanded && (
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold">{title}</h2>
          <Button variant="outline" onClick={() => setExpanded(false)}>
            <Minimize2 /> Exit full screen
          </Button>
        </header>
      )}
      <div className={cn("surface overflow-x-auto", expanded && "text-base [&_td]:py-3")}>{children}</div>
      {!expanded && <p className="mt-1.5 text-xs text-muted-foreground">Double-click the table to show it full screen.</p>}
    </div>
  );
}
