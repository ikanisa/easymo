"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

interface MotionProviderProps {
  children: React.ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" as const };
  const initialState = prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 };
  const animateState = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const exitState = prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 };

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={pathname}
        initial={initialState}
        animate={animateState}
        exit={exitState}
        transition={transition}
        id="main-content"
        tabIndex={-1}
        className="min-h-screen text-white"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
