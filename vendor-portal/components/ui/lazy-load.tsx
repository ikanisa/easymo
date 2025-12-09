"use client";

import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { LoadingSpinner } from "./loading-spinner";

interface LazyLoadProps<T extends Record<string, unknown>> {
  Component: LazyExoticComponent<ComponentType<T>>;
  fallback?: React.ReactNode;
  props: T;
}

/**
 * LazyLoad - Wrapper component for code-splitting with Suspense
 *
 * Features:
 * - Automatic code-splitting for better performance
 * - Loading fallback with spinner
 * - Error boundary integration ready
 * - Accessible loading states
 *
 * Usage:
 * ```tsx
 * import { lazy } from "react";
 * import { LazyLoad } from "@/components/ui/lazy-load";
 *
 * const HeavyComponent = lazy(() => import("./HeavyComponent"));
 *
 * <LazyLoad
 *   Component={HeavyComponent}
 *   props={{ data: myData }}
 *   fallback={<LoadingSpinner message="Loading component..." />}
 * />
 * ```
 */
export function LazyLoad<T extends Record<string, unknown>>({
  Component,
  fallback,
  props,
}: LazyLoadProps<T>) {
  const defaultFallback = (
    <div className="flex min-h-[200px] items-center justify-center">
      <LoadingSpinner size="md" />
    </div>
  );

  return (
    <Suspense fallback={fallback ?? defaultFallback}>
      <Component {...props} />
    </Suspense>
  );
}
