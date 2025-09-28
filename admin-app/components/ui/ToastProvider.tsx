"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import styles from "./ToastProvider.module.css";
import { Button } from "@/components/ui/Button";

export type ToastVariant = "info" | "success" | "error";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ pushToast, dismissToast }), [
    pushToast,
    dismissToast,
  ]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.container} aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[`toast_${toast.variant}`]}`}
          >
            <span>{toast.message}</span>
            <Button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              size="icon"
              variant="ghost"
              className={styles.dismissButton}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
