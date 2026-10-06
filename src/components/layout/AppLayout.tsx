import { NavLink, Outlet, useLocation } from "react-router";
import ifbbLogo from "@/assets/ifbb-logo.png";
import { useIconAnimation, type AnimatedIcon } from "@/components/icons/animated";
import { BicepsFlexedIcon } from "@/components/icons/biceps-flexed";
import { CalendarCheckIcon } from "@/components/icons/calendar-check";
import { LayersIcon } from "@/components/icons/layers";
import { UsersIcon } from "@/components/icons/users";
import { DatabaseTransfer } from "@/features/data/DatabaseTransfer";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: AnimatedIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/competitions", label: "Competitions", icon: CalendarCheckIcon },
  { to: "/athletes", label: "Athletes", icon: UsersIcon },
  { to: "/categories", label: "Categories", icon: LayersIcon },
  { to: "/exercises", label: "Exercises", icon: BicepsFlexedIcon },
];

export function AppLayout() {
  // Top-level section, so moving within a section (list → detail) doesn't replay the page entrance.
  const section = useLocation().pathname.split("/")[1];

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex flex-col items-center gap-2 border-b px-5 pt-6 pb-5">
          <img src={ifbbLogo} alt="IFBB" className="h-24 w-auto select-none" draggable={false} />
          <div className="text-center">
            <p className="font-heading text-base leading-tight font-semibold">Fitness Challenge</p>
            <p className="text-xs text-muted-foreground">& Speed Fit</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="grid gap-2 border-t px-3 py-3">
          <DatabaseTransfer />
          <p className="px-2 text-[11px] text-muted-foreground">Data is stored on this computer only. Export it to move it to another one.</p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div key={section} className="mx-auto max-w-6xl animate-in p-8 fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItemLink({ to, label, icon: Icon }: NavItem) {
  const { ref, triggers } = useIconAnimation();
  return (
    <NavLink
      to={to}
      {...triggers}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
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
          <Icon ref={ref} size={18} />
          {label}
        </>
      )}
    </NavLink>
  );
}
