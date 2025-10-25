"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { NAV_ITEMS } from "./nav-items";

interface MobileNavProps {
  onNavigate?: () => void;
}

export function MobileNav({ onNavigate }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile navigation" className="grid gap-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={classNames(
              "rounded-xl px-4 py-3 text-sm font-medium",
              active
                ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-border)]/20 hover:text-[color:var(--color-foreground)]",
            )}
            onClick={onNavigate}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
