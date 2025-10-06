"use client";

import { useEffect, useRef } from "react";
import styles from "./Drawer.module.css";
import { Button } from "@/components/ui/Button";

interface DrawerProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  position?: "right" | "left";
}

export function Drawer(
  { title, children, onClose, position = "right" }: DrawerProps,
) {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={position === "right"
          ? styles.drawerRight
          : styles.drawerLeft}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={drawerRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2>{title}</h2>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close drawer"
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
