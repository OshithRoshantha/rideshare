import { LayoutDashboard, Map, Settings, ShieldCheck, Ticket } from "lucide-react";

import { AppShell, type NavItem } from "@/app/layouts/AppShell";

const navItems: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/trips", label: "Trips", icon: Ticket },
  { to: "/admin/routes", label: "Routes", icon: Map },
  { to: "/admin/drivers", label: "Drivers", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  return <AppShell navItems={navItems} notificationsPath="/admin/dashboard" />;
}
