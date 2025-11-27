"use client";

import { useEffect } from "react";

export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        
        // Check for updates periodically
        registration.update().catch((error) => {
          console.warn("sw.update_failed", error);
        });
      } catch (error) {
        // Silently fail in development
        if (process.env.NODE_ENV === "production") {
          console.warn("sw.register_failed", error);
        }
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true, signal });
    }

    return () => {
      controller.abort();
    };
  }, []);
}
