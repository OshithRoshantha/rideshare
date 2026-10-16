import { CalendarClock, LayoutList, User, Wallet } from "lucide-react";

import { AppShell, type NavItem } from "@/app/layouts/AppShell";

const navItems: NavItem[] = [
  { to: "/driver/today", label: "Today", icon: CalendarClock },
  { to: "/driver/trips", label: "Trips", icon: LayoutList },
  { to: "/driver/earnings", label: "Earnings", icon: Wallet },
  { to: "/driver/profile", label: "Profile", icon: User },
];

export function DriverLayout() {
  return <AppShell navItems={navItems} notificationsPath="/driver/notifications" />;
}
