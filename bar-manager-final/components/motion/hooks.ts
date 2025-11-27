"use client";

import { useMemo } from "react";

import { usePrefersReducedMotion } from "./MotionProviders";

export function usePageTransition() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      } as const;
    }

    return {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -12 },
      transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
    } as const;
  }, [prefersReducedMotion]);
}

export function useStaggeredList(delayStep = 0.04) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return useMemo(() => {
    if (prefersReducedMotion) {
      return (index: number) => ({
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      });
    }

    return (index: number) => ({
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: {
        duration: 0.18,
        delay: index * delayStep,
        ease: [0.16, 1, 0.3, 1],
      },
    });
  }, [delayStep, prefersReducedMotion]);
}
