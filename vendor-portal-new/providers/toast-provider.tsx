"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { useTranslation } from "@/providers/i18n-provider";

interface ToastContextValue {
  notify: (message: string, options?: Parameters<typeof toast>[1]) => void;
  success: (message: string, options?: Parameters<typeof toast.success>[1]) => void;
  error: (message: string, options?: Parameters<typeof toast.error>[1]) => void;
  info: (message: string, options?: Parameters<typeof toast>[1]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [srMessage, setSrMessage] = useState("");

  const value = useMemo<ToastContextValue>(
    () => ({
      notify: (message, options) => {
        setSrMessage(message);
        toast(message, options);
      },
      info: (message, options) => {
        setSrMessage(message);
        toast(message, options);
      },
      success: (message, options) => {
        setSrMessage(message || t("toast.genericSuccess"));
        toast.success(message || t("toast.genericSuccess"), options);
      },
      error: (message, options) => {
        const text = message || t("toast.genericError");
        setSrMessage(text);
        toast.error(text, options);
      },
    }),
    [t]
  );

  return (
    <ToastContext.Provider value={value}>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srMessage}
      </div>
      <Toaster position="top-right" theme="dark" richColors closeButton />
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
