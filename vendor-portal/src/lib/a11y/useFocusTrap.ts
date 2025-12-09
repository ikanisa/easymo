import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
}

interface UseFocusTrapOptions {
  onEscape?: () => void;
  returnFocus?: () => void;
  initialFocus?: () => HTMLElement | null;
}

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement>,
  { onEscape, returnFocus, initialFocus }: UseFocusTrapOptions = {}
) {
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const target = initialFocus?.() ?? getFocusableElements(container)[0] ?? container;
    queueMicrotask(() => target?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === first || activeElement === container) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      const restoreFocus = returnFocus ?? (() => previousActiveRef.current?.focus());
      queueMicrotask(() => restoreFocus?.());
    };
  }, [active, containerRef, initialFocus, onEscape, returnFocus]);
}
