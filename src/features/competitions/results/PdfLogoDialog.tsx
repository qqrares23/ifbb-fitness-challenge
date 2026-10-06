import { useRef, useState } from "react";
import { toast } from "sonner";
import ifbbLogo from "@/assets/ifbb-logo.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rememberedLogos, rememberLogos, type LogoChoice, type PdfLogos } from "@/export/logos";
import { errorMessage } from "@/lib/errors";
import { loadLogo } from "@/lib/images";
import { cn } from "@/lib/utils";

interface PdfLogoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (logos: PdfLogos) => void;
}

/** Picks the logos for the PDF header (IFBB, a custom image, or none, on each side) before exporting. */
export function PdfLogoDialog({ open, onOpenChange, onExport }: PdfLogoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>PDF logos</DialogTitle>
          <DialogDescription>Choose the logo for each side of the results header. Your choice is remembered for next time.</DialogDescription>
        </DialogHeader>
        {open && <LogoForm onCancel={() => onOpenChange(false)} onExport={onExport} />}
      </DialogContent>
    </Dialog>
  );
}

function LogoForm({ onCancel, onExport }: { onCancel: () => void; onExport: (logos: PdfLogos) => void }) {
  const [logos, setLogos] = useState<PdfLogos>(rememberedLogos);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <LogoSide label="Left logo" value={logos.left} onChange={(left) => setLogos((l) => ({ ...l, left }))} />
        <LogoSide label="Right logo" value={logos.right} onChange={(right) => setLogos((l) => ({ ...l, right }))} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            rememberLogos(logos);
            onExport(logos);
          }}
        >
          Export PDF
        </Button>
      </DialogFooter>
    </>
  );
}

function LogoSide({ label, value, onChange }: { label: string; value: LogoChoice; onChange: (choice: LogoChoice) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = value.type === "ifbb" ? ifbbLogo : value.type === "custom" ? value.image.dataUrl : null;

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange({ type: "custom", image: await loadLogo(file) });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const option = (active: boolean, text: string, onClick: () => void) => (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {text}
    </Button>
  );

  return (
    <section className="grid gap-3 rounded-xl border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className={cn("flex h-28 items-center justify-center rounded-lg border bg-white p-2", !preview && "border-dashed")}>
        {preview ? <img src={preview} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted-foreground">No logo</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {option(value.type === "ifbb", "IFBB", () => onChange({ type: "ifbb" }))}
        {option(value.type === "custom", value.type === "custom" ? "Change image…" : "Other image…", () => fileInput.current?.click())}
        {option(value.type === "none", "None", () => onChange({ type: "none" }))}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </section>
  );
}
