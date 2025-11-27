"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/ToastProvider";

export function ServiceWorkerToast() {
  const { pushToast } = useToast();
  const hasSeenActivationMessage = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "SW_ACTIVATED") return;
      if (!hasSeenActivationMessage.current) {
        hasSeenActivationMessage.current = true;
        return;
      }

      pushToast("New version ready — refresh to update.", {
        variant: "info",
        actionLabel: "Refresh",
        onAction: () => window.location.reload(),
        duration: 0,
      });
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [pushToast]);

  return null;
}
