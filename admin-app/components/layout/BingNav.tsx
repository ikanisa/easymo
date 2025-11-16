"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import type { Ref } from "react";

import { NAV_SECTIONS } from "./nav-items";
import { toLinkHref } from "@/lib/link-helpers";

interface BingNavProps {
  mode?: "desktop" | "overlay";
  onClose?: () => void;
  firstLinkRef?: Ref<HTMLAnchorElement>;
}

export function BingNav({
  mode = "desktop",
  onClose,
  firstLinkRef,
}: BingNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  let firstLinkAssigned = false;

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
                const shouldAttachRef = mode === "overlay" && !firstLinkAssigned;
                if (shouldAttachRef) {
                  firstLinkAssigned = true;
                }
                return (
                  <Link
                    key={item.href}
                    href={toLinkHref(item.href)}
                    className={classNames("bing-nav__item", {
                      "bing-nav__item--active": active,
                    })}
                    onClick={mode === "overlay" ? onClose : undefined}
                    ref={shouldAttachRef ? firstLinkRef : undefined}
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
