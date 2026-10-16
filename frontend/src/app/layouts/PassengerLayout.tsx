import { Home, Search, Ticket, User, Wallet } from "lucide-react";

import { AppShell, type NavItem } from "@/app/layouts/AppShell";

const navItems: NavItem[] = [
  { to: "/app/home", label: "Home", icon: Home },
  { to: "/app/book", label: "Book", icon: Search },
  { to: "/app/rides", label: "Rides", icon: Ticket },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function PassengerLayout() {
  return <AppShell navItems={navItems} notificationsPath="/app/notifications" />;
}
