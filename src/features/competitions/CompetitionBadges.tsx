import { Timer, Trophy, type LucideIcon } from "lucide-react";
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

export const COMPETITION_KIND_ICONS: Record<CompetitionKind, LucideIcon> = { fitness_challenge: Trophy, speed_fit: Timer };

export function CompetitionKindBadge({ kind }: { kind: CompetitionKind }) {
  const Icon = COMPETITION_KIND_ICONS[kind];
  return (
    <Badge variant="outline" className="gap-1 border-gold/60 bg-gold/10 text-foreground">
      <Icon className="size-3" />
      {COMPETITION_KIND_LABELS[kind]}
    </Badge>
  );
}
