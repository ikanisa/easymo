"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

interface AddToHomeBannerProps {
  open: boolean;
  title: string;
  description: string;
  installLabel: string;
  dismissLabel: string;
  onInstall: () => void;
  onDismiss: () => void;
}

export function AddToHomeBanner({
  open,
  title,
  description,
  installLabel,
  dismissLabel,
  onInstall,
  onDismiss,
}: AddToHomeBannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const installButtonRef = useRef<HTMLButtonElement | null>(null);
  const dismissButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const installButton = installButtonRef.current;
    if (installButton) {
      setTimeout(() => installButton.focus(), 0);
    } else {
      containerRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = [installButtonRef.current, dismissButtonRef.current].filter(
        (element): element is HTMLButtonElement => Boolean(element)
      );

      if (focusable.length === 0) {
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex = currentIndex;

      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      }

      focusable[nextIndex]?.focus();
      event.preventDefault();
    },
    [onDismiss]
  );

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "fixed bottom-24 left-1/2 z-50 w-[min(420px,92%)] -translate-x-1/2",
        "rounded-3xl border border-white/10 bg-white/10 p-5 text-sm text-neutral-0 shadow-glass backdrop-blur"
      )}
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col gap-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-neutral-0">
            {title}
          </h2>
          <p id={descriptionId} className="mt-1 text-xs text-neutral-2">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onInstall}
            className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass"
            ref={installButtonRef}
          >
            {installLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-2"
            ref={dismissButtonRef}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
