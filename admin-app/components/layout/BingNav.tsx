"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { NAV_SECTIONS } from "./nav-items";

interface BingNavProps {
  mode?: "desktop" | "overlay";
  onClose?: () => void;
}

export function BingNav({ mode = "desktop", onClose }: BingNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Primary"
      className={classNames("bing-nav", {
        "bing-nav--overlay": mode === "overlay",
      })}
    >
      <div className="bing-nav__header">
        <div>
          <span className="bing-nav__logo">easyMO</span>
          <p className="bing-nav__tagline">Agent Control Room</p>
        </div>
        {mode === "overlay" && (
          <button
            type="button"
            className="bing-nav__close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>
      <div className="bing-nav__sections">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="bing-nav__section">
            <p className="bing-nav__section-label">{section.title}</p>
            <div className="bing-nav__section-items">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={classNames("bing-nav__item", {
                      "bing-nav__item--active": active,
                    })}
                    onClick={mode === "overlay" ? onClose : undefined}
                  >
                    <span aria-hidden className="bing-nav__icon">
                      {item.icon}
                    </span>
                    <span className="bing-nav__title">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
