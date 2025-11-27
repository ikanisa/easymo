"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Shield,
  Wallet,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  X,
  Headphones
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Insurance", href: "/insurance", icon: Shield },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
  { name: "AI Agents", href: "/agents", icon: Bot },
  { name: "Support", href: "/support", icon: Headphones },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface MobileSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function MobileSidebar({ open, setOpen }: MobileSidebarProps) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <div className="relative z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-900/80" aria-hidden="true" onClick={() => setOpen(false)} />

      <div className="fixed inset-0 flex">
        <div className="relative mr-16 flex w-full max-w-xs flex-1">
          <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
            <button type="button" className="-m-2.5 p-2.5" onClick={() => setOpen(false)}>
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>

          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-gray-900">easyMO Admin</span>
              </div>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              isActive
                                ? "bg-gray-50 text-primary-600"
                                : "text-gray-700 hover:bg-gray-50 hover:text-primary-600",
                              "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors"
                            )}
                          >
                            <item.icon
                              className={cn(
                                isActive ? "text-primary-600" : "text-gray-400 group-hover:text-primary-600",
                                "h-6 w-6 shrink-0 transition-colors"
                              )}
                              aria-hidden="true"
                            />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
                <li className="mt-auto">
                  <button
                    onClick={() => console.log("Logout")}
                    className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-error w-full transition-colors"
                  >
                    <LogOut
                      className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-error transition-colors"
                      aria-hidden="true"
                    />
                    Sign out
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
