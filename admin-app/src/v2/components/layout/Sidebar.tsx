"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  TruckIcon,
  MapPinIcon,
  ChartBarIcon,
  CogIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/v2/dashboard", icon: HomeIcon },
  { name: "Agents", href: "/v2/agents", icon: UsersIcon },
  { name: "Drivers", href: "/v2/drivers", icon: TruckIcon },
  { name: "Stations", href: "/v2/stations", icon: MapPinIcon },
  { name: "Analytics", href: "/v2/analytics", icon: ChartBarIcon },
  { name: "Settings", href: "/v2/settings", icon: CogIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="dashboard-shell__sidebar">
      <div className="dashboard-shell__sidebar-inner">
        <div className="dashboard-shell__sidebar-header">
          <h1 className="dashboard-shell__sidebar-title">EasyMO Admin</h1>
        </div>

        <nav className="dashboard-shell__sidebar-nav" aria-label="Primary">
          <ul>
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href);

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={[
                      "dashboard-shell__sidebar-link",
                      isActive ? "dashboard-shell__sidebar-link--active" : "",
                    ]
                      .join(" ")
                      .trim()}
                  >
                    <item.icon className="dashboard-shell__sidebar-icon" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
