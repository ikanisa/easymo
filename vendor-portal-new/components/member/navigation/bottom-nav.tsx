"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Landmark, WalletMinimal, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAVIGATION_ITEMS = [
  { href: "/member", label: "Home", icon: Home },
  { href: "/member/groups", label: "Groups", icon: Users },
  { href: "/member/saccos", label: "SACCOs", icon: Landmark },
  { href: "/member/pay", label: "Pay", icon: WalletMinimal },
  { href: "/member/profile", label: "Profile", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/50 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 text-neutral-0">
        {NAVIGATION_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-sm transition-all duration-interactive ease-interactive",
                  active ? "bg-white/15 text-neutral-0" : "text-neutral-1 hover:bg-white/10"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-6 w-6" aria-hidden />
                <span className="text-xs font-medium opacity-90">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
