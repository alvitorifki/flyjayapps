import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CalendarDays, ShieldCheck, LogOut, Bell, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/crew", label: "Crew", icon: Users },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/certificates", label: "Certificates", icon: ShieldCheck },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initials = (user?.name || "U")
    .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  const allNavItems = [
    ...navItems,
    { to: "/settings", label: "Settings", icon: Settings, end: false },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <img src="/logo-header-flyjaya.svg" alt="FlyJaya" className="h-8" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
              )
            }
          >
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-8 py-3">
            <div className="flex items-center gap-3 md:hidden">
              <img src="/logo-header-flyjaya.svg" alt="FlyJaya" className="h-7" />
            </div>
            <div className="hidden md:block">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {pathname === "/" ? "Overview" : pathname.replace("/", "").replace("-", " ")}
              </div>
              <div className="font-semibold text-foreground">
                Welcome back, {user?.name?.split(" ")[0] || "Crew"}
                {user?.role === "crew" && user?.rank && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">· {user.rank} · {user.employee_id}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="h-9 w-9 rounded-full gradient-hero flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-card">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — 5 items including Settings */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
        <div className="grid grid-cols-6 gap-0.5 px-1 pt-1">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      "h-8 w-10 flex items-center justify-center rounded-lg transition-colors",
                      isActive && "bg-primary-soft"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground"
          >
            <div className="h-8 w-10 flex items-center justify-center rounded-lg">
              <LogOut className="h-4 w-4" />
            </div>
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
}
