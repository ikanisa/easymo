"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={classNames(
        "sidebar",
        "hidden lg:flex flex-col gap-8 rounded-r-3xl border border-[color:var(--color-border)]/60",
        "bg-[color:var(--color-surface)]/85 backdrop-blur-2xl px-6 py-8 text-[color:var(--color-foreground)] shadow-[var(--elevation-low)]",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-muted)]">
        Admin Panel
      </div>
      {NAV_GROUPS.map((group) => {
        const groupItems = NAV_ITEMS.filter((item) => item.group === group);
        return (
          <div key={group} className="space-y-3">
            <div className="text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--color-muted)]/70">
              {group}
            </div>
            <ul className="flex flex-col gap-2">
              {groupItems.map((item) => {
                const isActive = pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={classNames(
                        "sidebar__link",
                        "group flex flex-col gap-1 rounded-2xl border border-transparent px-4 py-3 transition",
                        "bg-[color:var(--color-surface)]/40 text-[color:var(--color-foreground)]/85",
                        isActive
                          ? "sidebar__link--active border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/25 text-[color:var(--color-foreground)]"
                          : "hover:border-[color:var(--color-border)]/40 hover:bg-[color:var(--color-surface)]/80",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="sidebar__link-label text-sm font-medium tracking-tight">
                        {item.label}
                      </span>
                      <span className="sidebar__link-description text-xs text-[color:var(--color-muted)]">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
