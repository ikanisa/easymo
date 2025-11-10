"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { NAV_ITEMS } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sidebar" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href as any}
            className={classNames(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-border)]/20 hover:text-[color:var(--color-foreground)]",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
