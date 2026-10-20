import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/** A destructive action to confirm: its dialog text and the effect to run on confirm. */
export interface ConfirmRequest {
  title: string;
  description: string;
  run: () => void;
}

/** Owns confirm-dialog state and renders a destructive ConfirmDialog. Call `confirm(request)` to open it. */
export function useConfirm() {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={pending?.title ?? ""}
      description={pending?.description ?? ""}
      confirmLabel="Delete"
      destructive
      onConfirm={() => pending?.run()}
    />
  );
  return { confirm: setPending, dialog };
}
