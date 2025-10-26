"use client";

// Scaffolded registration hook for the admin service worker. Full offline
// persistence (cache hydration, queue replay UI) will land during Phase 7 of the
// roadmap.
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
        await navigator.serviceWorker.register("/sw.js");
      } catch (error) {
        console.warn("sw.register_failed", error);
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
