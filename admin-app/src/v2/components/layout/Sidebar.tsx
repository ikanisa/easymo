"use client";

import React from "react";
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
    <aside className="w-64 border-r border-gray-200 bg-white dashboard-shell__sidebar" aria-label="Primary navigation">
      <div className="flex h-full flex-col dashboard-shell__sidebar-inner">
        <div className="border-b border-gray-200 p-6 dashboard-shell__sidebar-header">
          <h1 className="text-xl font-semibold text-gray-900 dashboard-shell__sidebar-title">
            EasyMO Admin
          </h1>
        </div>

        <nav className="flex-1 p-4 dashboard-shell__sidebar-nav" aria-label="Section links">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href);

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
                      "dashboard-shell__sidebar-link",
                      isActive
                        ? "bg-blue-50 text-blue-600 dashboard-shell__sidebar-link--active"
                        : "text-gray-700 hover:bg-gray-50",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                    ]
                      .join(" ")
                      .trim()}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <item.icon className="h-5 w-5 dashboard-shell__sidebar-icon" />
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
