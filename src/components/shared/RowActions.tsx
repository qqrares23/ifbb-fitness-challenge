import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { AnimatedButton } from "./AnimatedButton";

interface RowActionsProps {
  /** Used in the buttons' accessible labels, e.g. "athlete" → "Edit athlete". */
  noun: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function RowActions({ noun, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex justify-end">
      <AnimatedButton icon={SquarePenIcon} variant="ghost" size="icon" aria-label={`Edit ${noun}`} onClick={onEdit} />
      {/* lucide-animated has no trash icon; a static one reads fine for a destructive action. */}
      <Button variant="ghost" size="icon" aria-label={`Delete ${noun}`} onClick={onDelete}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
}
