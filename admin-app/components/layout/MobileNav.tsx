"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { Button } from "@/components/ui/Button";
import { NAV_ITEMS } from "./nav-items";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

export function MobileNav({ open, onClose, onNavigate }: MobileNavProps) {
  const pathname = usePathname();

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

  if (!open) {
    return null;
  }

  const handleNavigate = () => {
    onNavigate?.();
    onClose();
  };

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
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "rounded-xl px-4 py-3 text-sm font-medium",
                  active
                    ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-border)]/20 hover:text-[color:var(--color-foreground)]",
                )}
                onClick={handleNavigate}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
