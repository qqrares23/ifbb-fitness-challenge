import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  /** Used in the buttons' accessible labels, e.g. "athlete" → "Edit athlete". */
  noun: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function RowActions({ noun, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="icon" aria-label={`Edit ${noun}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Delete ${noun}`} onClick={onDelete}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
}
