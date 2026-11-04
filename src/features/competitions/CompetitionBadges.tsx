import { BicepsFlexed, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CompetitionKind, CompetitionStatus } from "@/db/competitions";
import { COMPETITION_KIND_LABELS } from "@/lib/labels";

const STATUS_STYLES: Record<CompetitionStatus, { label: string; className: string }> = {
  draft: { label: "Setup", className: "bg-secondary text-secondary-foreground" },
  running: { label: "Live", className: "bg-emerald-600 text-white" },
  finished: { label: "Finished", className: "bg-primary text-primary-foreground" },
};

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <Badge className={className}>
      {status === "running" && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {label}
    </Badge>
  );
}

/** Shown next to athletes entered after the competition started. */
export function LateEntryBadge() {
  return (
    <Badge variant="outline" className="ml-2 border-amber-400/60 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800">
      Late entry
    </Badge>
  );
}

const KIND_ICONS = { fitness_challenge: BicepsFlexed, speed_fit: Timer } as const;

export function CompetitionKindBadge({ kind }: { kind: CompetitionKind }) {
  const Icon = KIND_ICONS[kind];
  return (
    <Badge variant="outline" className="gap-1 border-gold/60 bg-gold/10 text-foreground">
      <Icon className="size-3" />
      {COMPETITION_KIND_LABELS[kind]}
    </Badge>
  );
}
