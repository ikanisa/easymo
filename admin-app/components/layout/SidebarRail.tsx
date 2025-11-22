"use client";

import classNames from "classnames";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { toLinkHref } from "@/lib/link-helpers";

export function SidebarRail() {
  const pathname = usePathname();

  if (!NAV_ITEMS.length) {
    return null;
  }

  return (
    <aside className="sidebar-rail" aria-label="Admin navigation">
      <div className="sidebar-rail__brand" aria-hidden="true">
        <span className="sidebar-rail__glyph">◎</span>
      </div>
      <nav className="sidebar-rail__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={toLinkHref(item.href)}
              className={classNames("sidebar-rail__link", {
                "sidebar-rail__link--active": active,
              })}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
            >
              <span aria-hidden="true" className="sidebar-rail__icon">
                {item.icon ?? "•"}
              </span>
              <span className="sidebar-rail__label visually-hidden">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
