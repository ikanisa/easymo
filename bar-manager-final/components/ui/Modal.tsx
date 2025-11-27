"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/Button";

import styles from "./Modal.module.css";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: string | number;
}

export function Modal(
  { title, children, onClose, width = "min(640px, 90vw)" }: ModalProps,
) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = dialogNode.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) {
          event.preventDefault();
          dialogNode.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const currentActive = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (currentActive === firstElement || !dialogNode.contains(currentActive)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else if (currentActive === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    dialogNode.addEventListener("keydown", handleKeyDown);
    dialogNode.focus({ preventScroll: true });

    return () => {
      dialogNode.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.container}
        style={{ width }}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <Button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
            variant="ghost"
            size="icon"
          >
            ×
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
