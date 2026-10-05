import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex animate-in flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center fade-in-0 zoom-in-95 duration-300">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-gold/20 ring-1 ring-primary/10">
        <Icon className="size-7 text-primary" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
