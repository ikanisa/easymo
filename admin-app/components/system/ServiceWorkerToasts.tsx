"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export function ServiceWorkerToasts() {
  const { pushToast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || typeof payload !== "object") return;

      switch (payload.type) {
        case "SW_BACKGROUND_SYNC_QUEUED":
          pushToast("Request saved offline. We will retry automatically.", {
            variant: "info",
            duration: 6000,
          });
          break;
        case "SW_BACKGROUND_SYNC_SUCCESS":
          pushToast("Offline request completed successfully.", {
            variant: "success",
            duration: 5000,
          });
          break;
        case "SW_BACKGROUND_SYNC_RETRY":
          pushToast("Queued request still pending. We'll retry soon.", {
            variant: "warning",
            duration: 8000,
          });
          break;
        case "SW_BACKGROUND_SYNC_DROPPED":
          pushToast("Unable to deliver request. Please retry manually.", {
            variant: "error",
            duration: 8000,
          });
          break;
        default:
          break;
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", handleMessage);
  }, [pushToast]);

  return null;
}
