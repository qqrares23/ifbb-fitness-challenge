import { useState } from "react";
import { FileTextIcon } from "@/components/icons/file-text";
import { AnimatedButton } from "@/components/shared/AnimatedButton";
import type { CompetitionSetup } from "@/db/competitions";
import { runExport } from "../results/ExportButtons";
import { PdfLogoDialog } from "../results/PdfLogoDialog";

/** Saves the entry list as a PDF to print: every athlete, then each category's athletes. */
export function EntryListButton({ setup }: { setup: CompetitionSetup }) {
  const [choosingLogos, setChoosingLogos] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <AnimatedButton icon={FileTextIcon} variant="outline" disabled={busy || setup.entries.length === 0} onClick={() => setChoosingLogos(true)}>
        {busy ? "Exporting…" : "Print athlete list"}
      </AnimatedButton>
      <PdfLogoDialog
        open={choosingLogos}
        onOpenChange={setChoosingLogos}
        title="Athlete list PDF"
        onExport={(logos) => {
          setChoosingLogos(false);
          setBusy(true);
          void runExport("Athlete list", (m) => m.exportEntryList(setup, logos)).finally(() => setBusy(false));
        }}
      />
    </>
  );
}
