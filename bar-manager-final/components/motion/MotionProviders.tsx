"use client";

import { AnimatePresence, MotionConfig } from "framer-motion";
import { createContext, ReactNode, useContext } from "react";

const ReducedMotionContext = createContext<boolean>(false);

export function usePrefersReducedMotion() {
  return useContext(ReducedMotionContext);
}

export interface MotionProviderProps {
  children: ReactNode;
  reducedMotion?: boolean;
}

export function MotionProviders(
  { children, reducedMotion = false }: MotionProviderProps,
) {
  return (
    <ReducedMotionContext.Provider value={reducedMotion}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </MotionConfig>
    </ReducedMotionContext.Provider>
  );
}
