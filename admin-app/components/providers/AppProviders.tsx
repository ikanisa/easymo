"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { MotionProviders } from "@/components/motion/MotionProviders";
import { useServiceWorkerRegistration } from "@/app/sw/register";
import { ConnectivityProvider } from "@/components/providers/ConnectivityProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useServiceWorkerRegistration();

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const defaultActorId = process.env.NEXT_PUBLIC_DEFAULT_ACTOR_ID;
    if (!defaultActorId) return;
    const hasCookie = document.cookie.split(";").some((entry) => entry.trim().startsWith("admin_actor_id="));
    if (!hasCookie) {
      document.cookie = `admin_actor_id=${defaultActorId}; path=/; SameSite=Lax`;
    }
  }, []);

  return (
    <ThemeProvider>
      <QueryProvider>
        <ConnectivityProvider>
          <MotionProviders reducedMotion={prefersReducedMotion}>
            {children}
          </MotionProviders>
        </ConnectivityProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
