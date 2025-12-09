"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "../utils/cn";

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && !element.getAttribute("aria-hidden")
  );
}

const SIZE_STYLES: Record<NonNullable<DrawerProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  full: "max-w-[min(100vw,72rem)]",
};

export interface DrawerRenderProps {
  close: () => void;
  titleId: string;
  descriptionId?: string;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode | ((context: DrawerRenderProps) => ReactNode);
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
  side?: "right" | "left";
  initialFocusRef?: RefObject<HTMLElement> | null;
  labelledBy?: string;
  describedBy?: string;
  closeOnOverlayClick?: boolean;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  className,
  side = "right",
  initialFocusRef,
  labelledBy,
  describedBy,
  closeOnOverlayClick = true,
}: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) {
      setRender(true);
    }
  }, [open]);

  useEffect(() => {
    if (!render || !open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusTarget = initialFocusRef?.current ?? getFocusable(panel)[0] ?? panel;

    focusTarget?.focus({ preventScroll: true });

    return () => {
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef, render]);

  useEffect(() => {
    if (!render || !open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + focusable.length) % focusable.length
        : (currentIndex + 1) % focusable.length;
      event.preventDefault();
      focusable[nextIndex]?.focus({ preventScroll: true });
    };

    panel.addEventListener("keydown", handleKeyDown);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, render]);

  useEffect(() => {
    if (!render || !open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open, render]);

  const handleOverlayMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!closeOnOverlayClick) return;
      if (event.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  const titleId = useMemo(() => labelledBy ?? generatedTitleId, [generatedTitleId, labelledBy]);
  const descriptionId = useMemo(
    () => describedBy ?? (description ? generatedDescriptionId : undefined),
    [description, describedBy, generatedDescriptionId]
  );

  const handleTransitionEnd = useCallback(() => {
    if (!open) {
      setRender(false);
    }
  }, [open]);

  if (!render) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[70] flex bg-black/60 backdrop-blur-sm transition-opacity duration-300",
        open ? "opacity-100" : "opacity-0"
      )}
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className={cn(
          "relative flex h-full w-full",
          side === "right" ? "justify-end" : "justify-start"
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          ref={panelRef}
          className={cn(
            "flex h-full w-full transform flex-col gap-6 border-l border-white/10 bg-[color-mix(in_srgb,rgba(17,24,39,0.92)_80%,rgba(255,255,255,0.05))] p-6 text-neutral-0 shadow-2xl outline-none transition-transform duration-300",
            SIZE_STYLES[size],
            side === "right"
              ? open
                ? "translate-x-0"
                : "translate-x-full"
              : open
                ? "translate-x-0"
                : "-translate-x-full",
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : labelledBy}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-neutral-2 transition hover:border-white/40 hover:text-neutral-0"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>

          {title ? (
            <div className="pr-10">
              <h2 id={titleId} className="text-lg font-semibold text-neutral-0">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 text-sm text-neutral-2">
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto pr-2">
            {typeof children === "function"
              ? children({ close: onClose, titleId, descriptionId })
              : children}
          </div>

          {footer ? (
            <footer className="flex flex-wrap justify-end gap-2 text-xs uppercase tracking-[0.3em]">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
