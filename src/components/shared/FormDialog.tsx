import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FormDialogProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changing the key remounts the form, re-seeding its state (e.g. when a different record is opened). */
  formKey: string | number;
  /** Wider dialog, for pickers with a list. */
  wide?: boolean;
  children: ReactNode;
}

export function FormDialog({ title, open, onOpenChange, formKey, wide, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "sm:max-w-2xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div key={formKey}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

interface FormActionsProps {
  onCancel: () => void;
  submitLabel: string;
  saving: boolean;
  /** Extra reason to block submitting, e.g. nothing picked yet. */
  disabled?: boolean;
}

export function FormActions({ onCancel, submitLabel, saving, disabled }: FormActionsProps) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving || disabled}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

/**
 * Runs a dialog's save and closes it on success. A failure was already shown by the
 * mutation's error toast, so the dialog just stays open for another try.
 */
export async function saveAndClose(save: () => Promise<unknown>, close: () => void): Promise<void> {
  try {
    await save();
    close();
  } catch {
    // Reported by useDbMutation's onError.
  }
}
