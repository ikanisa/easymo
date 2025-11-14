"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { Search, Menu, X } from "lucide-react";
import { PANEL_NAVIGATION, type PanelNavGroup, type PanelNavGroupId } from "../layout/nav-items";
import { toLinkHref } from "@/lib/link-helpers";

interface EnhancedNavProps {
  onSearchOpen?: () => void;
  className?: string;
}

function isLinkActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * EnhancedNav: Combined sidebar/topbar navigation with accessibility features
 * 
 * Features:
 * - Active state styling with visual indicators
 * - Keyboard navigation support (Tab, Enter, Space)
 * - ARIA attributes for screen readers
 * - Skip link for keyboard users
 * - Responsive design (mobile + desktop)
 * - Search entry point integration
 */
export function EnhancedNav({ onSearchOpen, className }: EnhancedNavProps) {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-expand groups containing active links
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

  const handleToggleGroup = (groupId: PanelNavGroupId) => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileMenuOpen}
        aria-controls="enhanced-nav-menu"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Navigation sidebar */}
      <nav
        id="enhanced-nav-menu"
        role="navigation"
        aria-label="Primary navigation"
        className={classNames(
          "enhanced-nav fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-gray-200 shadow-sm transition-transform duration-300",
          "w-64 md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
      >
        {/* Header with search */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">easyMO</span>
            <span className="text-xs text-gray-500">Admin Panel</span>
          </div>
          <button
            type="button"
            onClick={onSearchOpen}
            className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open search"
            title="Search (⌘K / Ctrl+K)"
          >
            <Search className="h-5 w-5 text-gray-600" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Root link */}
          <div className="mb-6">
            <Link
              href={toLinkHref(root.href)}
              onClick={closeMobileMenu}
              className={classNames(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                activeRoot
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent",
              )}
              aria-current={activeRoot ? "page" : undefined}
            >
              <span className="text-lg" aria-hidden="true">
                {root.icon}
              </span>
              <span>{root.title}</span>
            </Link>
          </div>

          {/* Navigation groups */}
          {groups.map((group) => {
            const groupOpen = openGroups.has(group.id);
            const groupId = `nav-group-${group.id}`;
            const panelId = `${groupId}-panel`;

            return (
              <div key={group.id} className="mb-6">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => handleToggleGroup(group.id)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleToggleGroup(group.id))}
                  className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  aria-expanded={groupOpen}
                  aria-controls={panelId}
                  id={groupId}
                >
                  <span>{group.title}</span>
                  <span
                    className={classNames(
                      "transition-transform duration-200",
                      groupOpen ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </button>

                {/* Group description */}
                {group.description && (
                  <p className="px-4 mt-1 text-xs text-gray-500 leading-relaxed">
                    {group.description}
                  </p>
                )}

                {/* Group links */}
                {groupOpen && (
                  <ul
                    id={panelId}
                    role="group"
                    aria-labelledby={groupId}
                    className="mt-2 space-y-1"
                  >
                    {group.links.map((item) => {
                      const active = isLinkActive(item.href, pathname);
                      return (
                        <li key={item.href}>
                          <Link
                            href={toLinkHref(item.href)}
                            onClick={closeMobileMenu}
                            className={classNames(
                              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                              "group relative",
                              active
                                ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent",
                            )}
                            aria-current={active ? "page" : undefined}
                            title={item.description || item.title}
                          >
                            {item.icon && (
                              <span className="text-base" aria-hidden="true">
                                {item.icon}
                              </span>
                            )}
                            <span className="truncate">{item.title}</span>
                            {active && (
                              <span
                                className="ml-auto h-2 w-2 rounded-full bg-blue-600"
                                aria-label="Current page"
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer with accessibility info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-white border border-gray-300 rounded">Tab</kbd> to navigate
          </p>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
}
