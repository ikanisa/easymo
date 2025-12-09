"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/staff/onboarding", label: "Onboarding" },
  { href: "/staff/allocations", label: "Allocation triage" },
  { href: "/staff/exceptions", label: "Exceptions" },
  { href: "/staff/export", label: "Exports" },
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Staff navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-50"
                : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
