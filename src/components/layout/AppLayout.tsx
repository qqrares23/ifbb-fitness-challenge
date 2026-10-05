import { NavLink, Outlet } from "react-router";
import { Dumbbell, Trophy, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/competitions", label: "Competitions", icon: Trophy },
  { to: "/athletes", label: "Athletes", icon: Users },
  { to: "/exercises", label: "Exercises", icon: Dumbbell },
];

export function AppLayout() {
  return (
    <div className="flex h-screen bg-muted/40">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
        <div className="border-b px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">IFBB</p>
          <p className="font-heading text-lg font-semibold leading-tight">Fitness Challenge</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
