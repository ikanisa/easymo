"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavigationRailProps {
  groups: Array<{
    id: string;
    title: string;
    description?: string;
    items: NavRailItem[];
  }>;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  saccoName: string;
  brandLabel: string;
}

type NavRailItem = {
  id: string;
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: { label: string; tone: string } | null;
  isActive?: boolean;
};

const BADGE_TONE_CLASSES: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-200",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

export function NavigationRail({
  groups,
  collapsed,
  onToggleCollapsed,
  collapsedGroups,
  onToggleGroup,
  saccoName,
  brandLabel,
}: NavigationRailProps) {
  const pathname = usePathname();

  const groupSections = useMemo(
    () =>
      groups.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          isActive: pathname === item.href || pathname.startsWith(`${item.href}/`),
        })),
      })),
    [groups, pathname]
  );

  return (
    <aside
      className={cn(
        "hidden border-r border-white/10 bg-[color-mix(in_srgb,#020617_90%,rgba(255,255,255,0.04))] text-neutral-2/90 backdrop-blur-lg lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        <div
          className={cn(
            "transition-all",
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          )}
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-neutral-6">
            {brandLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-1">{saccoName}</p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-3 transition hover:bg-white/10 hover:text-neutral-0"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6" aria-label="Primary navigation">
        {groupSections.map((section) => {
          const isCollapsed = collapsedGroups[section.id];
          const hasItems = section.items.length > 0;
          if (!hasItems) return null;

          return (
            <section key={section.id} className="space-y-2">
              <button
                type="button"
                onClick={() => onToggleGroup(section.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-neutral-5 transition",
                  collapsed ? "justify-center px-1" : "hover:bg-white/5 hover:text-neutral-2"
                )}
                aria-expanded={!isCollapsed}
              >
                {collapsed ? (
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-neutral-6">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">{section.title}</span>
                  </span>
                ) : (
                  <>
                    <span className="truncate">{section.title}</span>
                    <span className="text-neutral-6">{section.description}</span>
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </>
                )}
              </button>

              <div className={cn("space-y-1", collapsed && "px-1")}>
                {renderItems(section.items, collapsed, isCollapsed)}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

function renderItems(items: NavRailItem[], collapsed: boolean, isCollapsed: boolean) {
  if (isCollapsed) {
    return null;
  }

  return (
    <ul className={cn("space-y-1", collapsed && "space-y-2")}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                item.isActive
                  ? "bg-white/15 text-neutral-0 shadow-lg"
                  : "text-neutral-5 hover:bg-white/10 hover:text-neutral-0"
              )}
              aria-current={item.isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  item.isActive && "text-kigali"
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <Fragment>
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-tight text-neutral-1 group-hover:text-neutral-0">
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-xs text-neutral-6">{item.description}</p>
                    )}
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                        BADGE_TONE_CLASSES[item.badge.tone] ?? BADGE_TONE_CLASSES.info
                      )}
                    >
                      {item.badge.label}
                    </span>
                  )}
                </Fragment>
              )}
              {collapsed && item.badge && (
                <span
                  className={cn(
                    "absolute right-2 top-2 h-2 w-2 rounded-full border border-neutral-12",
                    BADGE_TONE_CLASSES[item.badge.tone] ?? BADGE_TONE_CLASSES.info
                  )}
                  aria-hidden="true"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
