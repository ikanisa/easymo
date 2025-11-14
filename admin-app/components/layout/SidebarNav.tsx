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
import { toLinkHref } from "@/lib/link-helpers";

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
    <nav aria-label="Sidebar" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={toLinkHref(root.href)}
          className={classNames(
            "rounded-lg px-4 py-2.5 text-base font-semibold transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            activeRoot
              ? "bg-blue-600 text-white shadow-sm border-l-4 border-blue-700"
              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
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
          <div key={group.id} className="flex flex-col gap-3">
            <button
              type="button"
              className="flex items-center justify-between px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500 pointer-events-none"
              aria-label={`${group.title} section`}
              tabIndex={-1}
            >
              <span>{group.title}</span>
            </button>
            <div id={panelId}>
              <ul className="flex flex-col gap-1">
                {group.links.map((item) => {
                  const active = isLinkActive(item.href, pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={toLinkHref(item.href)}
                        className={classNames(
                          "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                          "group relative",
                          active
                            ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent",
                        )}
                        aria-current={active ? "page" : undefined}
                        title={item.title}
                      >
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {group.description ? (
              <p className="px-4 text-xs text-gray-500 leading-relaxed">
                {group.description}
              </p>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
