import { NavLink, Outlet, useLocation } from "react-router";
import { Dumbbell, Trophy, Users, type LucideIcon } from "lucide-react";
import ifbbLogo from "@/assets/ifbb-logo.png";
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
  // Top-level section, so moving within a section (list → detail) doesn't replay the page entrance.
  const section = useLocation().pathname.split("/")[1];

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex flex-col items-center gap-2 border-b px-5 pt-6 pb-5">
          <img src={ifbbLogo} alt="IFBB" className="h-20 w-auto select-none" draggable={false} />
          <div className="text-center">
            <p className="font-heading text-base leading-tight font-semibold">Fitness Challenge</p>
            <p className="text-xs text-muted-foreground">& Speed Fit</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold transition-transform duration-300",
                      isActive ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="border-t px-5 py-3 text-[11px] text-muted-foreground">Data is stored on this computer only.</p>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div key={section} className="mx-auto max-w-6xl animate-in p-8 fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
