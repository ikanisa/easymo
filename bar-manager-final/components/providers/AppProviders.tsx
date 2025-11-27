"use client";

import { ReactNode, useEffect, useState } from "react";

import { useServiceWorkerRegistration } from "@/app/sw/register";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MotionProviders } from "@/components/motion/MotionProviders";
import { ConnectivityProvider } from "@/components/providers/ConnectivityProvider";
import { SupabaseAuthProvider } from "@/components/providers/SupabaseAuthProvider";

import { ThemeProvider } from "./ThemeProvider";

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

  const content = (
    <ThemeProvider>
      <ConnectivityProvider>
        <SupabaseAuthProvider>
          <MotionProviders reducedMotion={mounted ? prefersReducedMotion : false}>
            {children}
          </MotionProviders>
        </SupabaseAuthProvider>
      </ConnectivityProvider>
    </ThemeProvider>
  );

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
