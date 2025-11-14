"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { Button } from "@/components/ui/Button";
import {
  PANEL_NAVIGATION,
  type PanelNavGroupId,
} from "./nav-items";
import { toLinkHref } from "@/lib/link-helpers";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

export function MobileNav({ open, onClose, onNavigate }: MobileNavProps) {
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
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      for (const group of groups) {
        if (
          group.links.some(
            (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
          )
        ) {
          next.add(group.id);
        }
      }
      return next;
    });
  }, [groups, pathname]);

  const activeRoot = useMemo(
    () => pathname === root.href || pathname.startsWith(`${root.href}/`),
    [pathname, root.href],
  );

  const handleNavigate = () => {
    onNavigate?.();
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      onClick={onClose}
    >
      <div
        className="flex h-full w-80 max-w-[85vw] flex-col gap-6 bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-high)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            Menu
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={onClose}
          >
            ×
          </Button>
        </div>
        <nav aria-label="Mobile navigation" className="grid gap-2">
          <Link
            href={toLinkHref(root.href)}
            className={classNames(
              "rounded-xl px-4 py-3 text-sm font-semibold",
              activeRoot
                ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                : "text-[color:var(--color-foreground)] hover:bg-[color:var(--color-border)]/20",
            )}
            aria-current={activeRoot ? "page" : undefined}
            onClick={handleNavigate}
          >
            {root.title}
          </Link>
          {groups.map((group) => {
            const sectionOpen = openGroups.has(group.id);
            const panelId = `mobile-nav-${group.id}`;
            return (
              <div key={group.id} className="rounded-lg border border-[color:var(--color-border)]/60">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition hover:text-[color:var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
                  aria-expanded={sectionOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenGroups((previous) => {
                      const next = new Set(previous);
                      if (next.has(group.id)) {
                        next.delete(group.id);
                      } else {
                        next.add(group.id);
                      }
                      return next;
                    })
                  }
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
                <div id={panelId} hidden={!sectionOpen} className="border-t border-[color:var(--color-border)]/40">
                  <ul className="flex flex-col gap-1 p-2">
                    {group.links.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <li key={item.href}>
                          <Link
                            href={toLinkHref(item.href)}
                            className={classNames(
                              "block rounded-lg px-3 py-2 text-sm font-medium",
                              active
                                ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                                : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-border)]/20 hover:text-[color:var(--color-foreground)]",
                            )}
                            aria-current={active ? "page" : undefined}
                            onClick={handleNavigate}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {group.description ? (
                  <p className="border-t border-[color:var(--color-border)]/40 px-4 py-2 text-xs text-[color:var(--color-muted)]">
                    {group.description}
                  </p>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
