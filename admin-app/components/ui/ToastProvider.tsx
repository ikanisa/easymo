"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import styles from "./ToastProvider.module.css";
import { Button } from "@/components/ui/Button";

export type ToastVariant = "info" | "success" | "error";

type ToastOptions = {
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number | null;
};

type StructuredToastContent = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
} & Pick<ToastOptions, "actionLabel" | "onAction" | "duration">;

type ToastContent = string | StructuredToastContent;

interface Toast {
  id: string;
  title?: string;
  description: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number | null;
}

const VARIANT_ICON: Record<ToastVariant, JSX.Element> = {
  info: <Info aria-hidden className={styles.icon} />, 
  success: <CheckCircle2 aria-hidden className={styles.icon} />, 
  error: <TriangleAlert aria-hidden className={`${styles.icon} ${styles.iconError}`} />,
};

const VARIANT_ROLE: Record<ToastVariant, { role: "status" | "alert"; ariaLive: "polite" | "assertive" }> = {
  info: { role: "status", ariaLive: "polite" },
  success: { role: "status", ariaLive: "polite" },
  error: { role: "alert", ariaLive: "assertive" },
};

interface ToastContextValue {
  pushToast: (message: ToastContent, options?: ToastVariant | ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: ToastContent, options?: ToastVariant | ToastOptions) => {
      const id = crypto.randomUUID();
      const normalizedOptions: ToastOptions = typeof options === "string"
        ? { variant: options }
        : options ?? {};
      const normalizedContent: StructuredToastContent =
        typeof message === "string"
          ? { description: message }
          : message;
      const variant = normalizedContent.variant ?? normalizedOptions.variant ?? "info";
      const description =
        normalizedContent.description ??
        (typeof message === "string" ? message : normalizedContent.title);
      const toast: Toast = {
        id,
        title: typeof message === "string" ? undefined : normalizedContent.title,
        description: description ?? "",
        variant,
        actionLabel: normalizedContent.actionLabel ?? normalizedOptions.actionLabel,
        onAction: normalizedContent.onAction ?? normalizedOptions.onAction,
        duration: (normalizedContent.duration ?? normalizedOptions.duration) ?? undefined,
      };

      setToasts((prev) => [...prev, toast]);

      const delay = toast.duration ?? 4000;
      if (typeof window !== "undefined" && delay > 0) {
        window.setTimeout(() => dismissToast(id), delay);
      }
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
            role={VARIANT_ROLE[toast.variant].role}
            aria-live={VARIANT_ROLE[toast.variant].ariaLive}
          >
            <span className={styles.iconWrapper}>{VARIANT_ICON[toast.variant]}</span>
            <span className={styles.message}>
              {toast.title ? <span className={styles.title}>{toast.title}</span> : null}
              <span className={styles.description}>{toast.description}</span>
            </span>
            {toast.onAction && toast.actionLabel
              ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id);
                  }}
                  offlineBehavior="allow"
                  className={styles.actionButton}
                >
                  {toast.actionLabel}
                </Button>
              )
              : null}
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
