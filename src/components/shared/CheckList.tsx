import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CheckListItem {
  id: number;
  label: ReactNode;
  detail?: ReactNode;
  /** When set the item can't be ticked, and this explains why. */
  disabledReason?: string;
}

interface CheckListProps {
  items: CheckListItem[];
  selected: ReadonlySet<number>;
  onToggle: (id: number, checked: boolean) => void;
  /** Shown when `items` is empty. */
  empty: ReactNode;
}

/** A scrollable list of tickable rows, for "pick several of these" dialogs. */
export function CheckList({ items, selected, onToggle, empty }: CheckListProps) {
  return (
    <div className="max-h-[45vh] overflow-y-auto rounded-xl border">
      {items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map(({ id, label, detail, disabledReason }) => {
            const htmlId = `checklist-${id}`;
            const enabled = !disabledReason;
            return (
              <li key={id}>
                <label
                  htmlFor={htmlId}
                  className={cn("flex items-start gap-3 px-4 py-2.5 transition-colors", enabled ? "cursor-pointer hover:bg-muted/50" : "opacity-60")}
                >
                  <Checkbox
                    id={htmlId}
                    className="mt-0.5"
                    disabled={!enabled}
                    checked={enabled && selected.has(id)}
                    onCheckedChange={(checked) => onToggle(id, checked === true)}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{label}</span>
                    {detail && <span className="ml-2 text-xs text-muted-foreground">{detail}</span>}
                    {disabledReason && <span className="block text-xs text-destructive">{disabledReason}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Immutable add/remove for the selected-ids state of a CheckList. */
export function toggleInSet(set: ReadonlySet<number>, id: number, checked: boolean): Set<number> {
  const next = new Set(set);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}
