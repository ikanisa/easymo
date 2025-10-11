"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";

const EVENT_COPY: Record<string, { message: string; variant: 'info' | 'success' | 'warning' | 'error'; duration?: number; }> = {
  SW_BACKGROUND_SYNC_QUEUED: {
    message: "Request saved offline. We’ll retry automatically soon.",
    variant: "info",
  },
  SW_BACKGROUND_SYNC_SUCCESS: {
    message: "Offline request delivered successfully.",
    variant: "success",
    duration: 5000,
  },
  SW_BACKGROUND_SYNC_RETRY: {
    message: "Retrying queued request. We’ll keep you posted.",
    variant: "warning",
  },
  SW_BACKGROUND_SYNC_DROPPED: {
    message: "We couldn’t deliver a queued request. Please resend manually.",
    variant: "error",
  },
};

export function ServiceWorkerToasts() {
  const { pushToast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || typeof payload !== "object") return;

      const entry = EVENT_COPY[payload.type as string];
      if (!entry) return;

      pushToast(entry.message, {
        variant: entry.variant,
        duration: entry.duration ?? 7000,
      });
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", handleMessage);
  }, [pushToast]);

  return null;
}
