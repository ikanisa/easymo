"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode, RefObject } from "react";
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

const SIZE_STYLES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(92vw,68rem)]",
};

export interface ModalRenderProps {
  close: () => void;
  titleId: string;
  descriptionId?: string;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode | ((context: ModalRenderProps) => ReactNode);
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  initialFocusRef?: RefObject<HTMLElement> | null;
  hideCloseButton?: boolean;
  labelledBy?: string;
  describedBy?: string;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  className,
  initialFocusRef,
  hideCloseButton = false,
  labelledBy,
  describedBy,
  closeOnOverlayClick = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusTarget = initialFocusRef?.current ?? getFocusable(panel)[0] ?? panel;

    focusTarget?.focus({ preventScroll: true });

    const restoreFocus = () => {
      if (previouslyFocused && previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };

    return () => restoreFocus();
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

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

  if (!open) {
    return null;
  }

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={panelRef}
        className={cn(
          "relative w-full rounded-[calc(var(--radius-xl)_*_1.1)] border border-white/10 bg-[color-mix(in_srgb,rgba(17,24,39,0.92)_70%,rgba(255,255,255,0.08))] p-6 text-neutral-0 shadow-2xl outline-none",
          SIZE_STYLES[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : labelledBy}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {!hideCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-neutral-2 transition hover:border-white/40 hover:text-neutral-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        {title ? (
          <div className="space-y-2 pr-10">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-0">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-neutral-2">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={cn("mt-4 space-y-4", title ? "pt-2" : undefined)}>
          {typeof children === "function"
            ? children({ close: onClose, titleId, descriptionId })
            : children}
        </div>

        {footer ? (
          <footer className="mt-6 flex flex-wrap justify-end gap-2 text-xs uppercase tracking-[0.3em]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
