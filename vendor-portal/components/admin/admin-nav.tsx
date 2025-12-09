"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/countries", label: "Countries" },
  { href: "/admin/telcos", label: "Telco providers" },
  { href: "/admin/partners", label: "Partner config" },
  { href: "/admin/invites", label: "Staff invites" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin navigation">
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
                ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                : "border-ink/10 bg-white text-ink/70 hover:border-ink/20 hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
