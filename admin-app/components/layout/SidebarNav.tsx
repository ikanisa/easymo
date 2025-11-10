"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import {
  PANEL_NAVIGATION,
  type PanelNavGroup,
  type PanelNavGroupId,
} from "./nav-items";

function isLinkActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { root, groups } = PANEL_NAVIGATION;
  const [openGroups, setOpenGroups] = useState<Set<PanelNavGroupId>>(() => {
    const initial = new Set<PanelNavGroupId>();
    for (const group of groups) {
      if (!group.collapsedByDefault) {
        initial.add(group.id);
      }
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      for (const group of groups) {
        if (group.links.some((link) => isLinkActive(link.href, pathname))) {
          next.add(group.id);
        }
      }
      return next;
    });
  }, [groups, pathname]);

  const activeRoot = useMemo(
    () => isLinkActive(root.href, pathname),
    [pathname, root.href],
  );

  const handleToggle = (group: PanelNavGroup) => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group.id)) {
        next.delete(group.id);
      } else {
        next.add(group.id);
      }
      return next;
    });
  };

  return (
    <nav aria-label="Sidebar" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={root.href}
          className={classNames(
            "rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-accent)]/60",
            activeRoot
              ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
              : "text-[color:var(--color-foreground)] hover:bg-[color:var(--color-border)]/20",
          )}
          aria-current={activeRoot ? "page" : undefined}
        >
          {root.title}
        </Link>
      </div>
      {groups.map((group) => {
        const sectionOpen = openGroups.has(group.id);
        const panelId = `sidebar-nav-${group.id}`;
        return (
          <div key={group.id} className="flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition hover:text-[color:var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-accent)]/60"
              aria-expanded={sectionOpen}
              aria-controls={panelId}
              onClick={() => handleToggle(group)}
            >
              <span>{group.title}</span>
              <span
                aria-hidden="true"
                className={classNames(
                  "transition-transform",
                  sectionOpen ? "rotate-90" : "rotate-0",
                )}
              >
                ›
              </span>
            </button>
            <div id={panelId} hidden={!sectionOpen}>
              <ul className="flex flex-col gap-1">
                {group.links.map((item) => {
                  const active = isLinkActive(item.href, pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={classNames(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-accent)]/60",
                          active
                            ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                            : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-border)]/20 hover:text-[color:var(--color-foreground)]",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {group.description ? (
              <p className="px-4 text-xs text-[color:var(--color-muted)]">
                {group.description}
              </p>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
