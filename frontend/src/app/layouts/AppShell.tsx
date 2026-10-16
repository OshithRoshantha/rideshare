import { type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { type LucideIcon, Bell, LogOut, Moon, Sun } from "lucide-react";
import clsx from "clsx";

import { APP_NAME } from "@/lib/config";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function useTheme() {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };
  return { toggle };
}

export function AppShell({
  navItems,
  title,
  notificationsPath = "/app/notifications",
}: {
  navItems: NavItem[];
  title?: string;
  notificationsPath?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { toggle } = useTheme();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data as { read: boolean }[],
    refetchInterval: 30_000,
  });
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border px-4 py-6 md:flex">
        <Link to="/" className="mb-8 px-2 text-lg font-bold text-accent">
          {APP_NAME}
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface hover:text-text-primary",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface"
        >
          <LogOut className="h-5 w-5" />
          Log out
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
          <h1 className="text-lg font-semibold">{title ?? user?.full_name}</h1>
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle dark mode"
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </button>
            <Link
              to={notificationsPath}
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-bg/95 backdrop-blur md:hidden">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
                active ? "text-accent" : "text-text-secondary",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
