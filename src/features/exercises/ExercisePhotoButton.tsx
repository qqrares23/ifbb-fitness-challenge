import { useState, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ExercisePhotoButtonProps {
  name: string;
  photo: string | null;
  /** What to click; defaults to a small thumbnail (or a camera icon when there's no photo). */
  children?: ReactNode;
  className?: string;
}

/** Opens an exercise's photo large, so a judge can check how it is performed. Renders nothing clickable without a photo. */
export function ExercisePhotoButton({ name, photo, children, className }: ExercisePhotoButtonProps) {
  const [open, setOpen] = useState(false);
  if (!photo) return children ?? null;

  return (
    <>
      <button
        type="button"
        title={`Show how "${name}" is performed`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn("cursor-zoom-in", className)}
      >
        {children ?? <img src={photo} alt={name} className="size-12 rounded-md border object-cover" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          <img src={photo} alt={name} className="max-h-[75vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A small camera mark next to an exercise name that opens its photo. */
export function PhotoHint({ name, photo }: { name: string; photo: string | null }) {
  return (
    <ExercisePhotoButton name={name} photo={photo} className="inline-flex align-middle text-muted-foreground hover:text-foreground">
      {photo ? <Camera className="size-3.5" aria-label={`Photo of ${name}`} /> : null}
    </ExercisePhotoButton>
  );
}
