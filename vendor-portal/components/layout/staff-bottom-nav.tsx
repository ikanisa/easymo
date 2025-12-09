"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  ArrowLeftRight, 
  FileText,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAFF_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/ikimina", label: "Groups", icon: Users },
  { href: "/recon", label: "Recon", icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/profile", label: "Profile", icon: Settings },
] as const;

export function StaffBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-surface/95 backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-center justify-between px-2 py-2 safe-area-inset-bottom">
        {STAFF_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-sm transition-all duration-150",
                  active 
                    ? "bg-primary-500/20 text-primary-400" 
                    : "text-foreground-subtle hover:bg-surface-subtle hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon 
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active && "scale-110"
                  )} 
                  aria-hidden="true" 
                />
                <span className={cn(
                  "text-[0.65rem] font-medium",
                  active ? "opacity-100" : "opacity-80"
                )}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
