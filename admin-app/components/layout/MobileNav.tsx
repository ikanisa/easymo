"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { Drawer } from "@/components/ui/Drawer";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();

  if (!open) {
    return null;
  }

  return (
    <Drawer title="Navigation" onClose={onClose} position="left">
      <nav aria-label="Primary navigation" className="flex flex-col gap-6">
        {NAV_GROUPS.map((group) => {
          const groupItems = NAV_ITEMS.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group}
              </div>
              <ul className="flex flex-col gap-2">
                {groupItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={classNames(
                          "flex flex-col gap-1 rounded-xl border px-4 py-3 transition",
                          isActive
                            ? "border-blue-400/70 bg-blue-500/10 text-slate-900"
                            : "border-transparent bg-white/40 text-slate-700 hover:border-slate-200/80 hover:bg-white/70",
                        )}
                        aria-current={isActive ? "page" : undefined}
                        onClick={onClose}
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.description}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </Drawer>
  );
}
