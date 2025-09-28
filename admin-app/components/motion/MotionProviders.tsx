"use client";

import { createContext, ReactNode, useContext } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

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
