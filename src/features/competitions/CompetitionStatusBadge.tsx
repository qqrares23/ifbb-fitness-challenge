import { Badge } from "@/components/ui/badge";
import type { CompetitionStatus } from "@/db/competitions";
import { cn } from "@/lib/utils";

const STYLES: Record<CompetitionStatus, { label: string; className: string }> = {
  draft: { label: "Setup", className: "bg-secondary text-secondary-foreground" },
  running: { label: "Running", className: "bg-emerald-600 text-white" },
  finished: { label: "Finished", className: "bg-primary text-primary-foreground" },
};

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const { label, className } = STYLES[status];
  return <Badge className={cn(className)}>{label}</Badge>;
}
