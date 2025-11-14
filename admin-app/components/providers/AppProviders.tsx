"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { MotionProviders } from "@/components/motion/MotionProviders";
import { useServiceWorkerRegistration } from "@/app/sw/register";
import { ConnectivityProvider } from "@/components/providers/ConnectivityProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useServiceWorkerRegistration();

  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  if (!mounted) {
    return (
      <ThemeProvider>
        <ConnectivityProvider>
          <MotionProviders reducedMotion={false}>
            {children}
          </MotionProviders>
        </ConnectivityProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ConnectivityProvider>
        <MotionProviders reducedMotion={prefersReducedMotion}>
          {children}
        </MotionProviders>
      </ConnectivityProvider>
    </ThemeProvider>
  );
}
