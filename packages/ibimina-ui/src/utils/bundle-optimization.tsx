/**
 * Bundle Optimization Utilities
 * Tools for code splitting, lazy loading, and bundle analysis
 */

import { ComponentType, lazy, LazyExoticComponent, Suspense, ReactNode } from "react";

/**
 * Create a lazy-loaded component with automatic retry on failure
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: {
    retries?: number;
    retryDelay?: number;
    fallback?: ReactNode;
  } = {}
): LazyExoticComponent<T> {
  const { retries = 3, retryDelay = 1000, fallback = null } = options;

  const load = async (attempt = 1): Promise<{ default: T }> => {
    try {
      return await factory();
    } catch (error) {
      if (attempt >= retries) {
        console.error(`Failed to load component after ${retries} attempts:`, error);
        throw error;
      }

      console.warn(`Component load failed (attempt ${attempt}/${retries}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      return load(attempt + 1);
    }
  };

  return lazy(() => load());
}

/**
 * Preload a lazy component
 */
export function preload<T extends ComponentType<any>>(
  component: LazyExoticComponent<T>
): Promise<{ default: T }> {
  // @ts-ignore - accessing internal _payload
  return component._payload?._result || component._payload?._fn?.();
}

/**
 * HOC to wrap lazy components with Suspense boundary
 */
export function withSuspense<P extends object>(
  Component: LazyExoticComponent<ComponentType<P>>,
  fallback: ReactNode = null
) {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    );
  };
}

/**
 * Prefetch routes on hover/focus
 */
export function usePrefetch() {
  const prefetch = (href: string) => {
    if (typeof window === "undefined") return;

    // Use Next.js built-in prefetch if available
    if ("next" in window && typeof (window as any).next?.router?.prefetch === "function") {
      (window as any).next.router.prefetch(href);
      return;
    }

    // Fallback: prefetch as a regular link
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  };

  return { prefetch };
}

/**
 * Bundle size tracking for development
 */
export function logBundleSize(componentName: string) {
  if (process.env.NODE_ENV !== "development") return;

  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;

  performance.mark(startMark);

  return () => {
    performance.mark(endMark);
    try {
      performance.measure(`${componentName}-load`, startMark, endMark);
      const measure = performance.getEntriesByName(`${componentName}-load`)[0];
      console.log(`📦 ${componentName} loaded in ${measure.duration.toFixed(2)}ms`);
    } catch (error) {
      // Ignore errors
    }
  };
}

/**
 * Dynamic import with better error handling
 */
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  componentName: string
): Promise<T> {
  try {
    const module = await importFn();
    return module;
  } catch (error) {
    console.error(`Failed to dynamically import ${componentName}:`, error);
    throw new Error(`Could not load ${componentName}. Please refresh the page.`);
  }
}

/**
 * Tree-shakeable feature flags
 */
export const features = {
  enablePWA: process.env.NEXT_PUBLIC_ENABLE_PWA === "true",
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
  enableChat: process.env.NEXT_PUBLIC_ENABLE_CHAT === "true",
  enableTapMoMo: process.env.NEXT_PUBLIC_ENABLE_TAPMOMO === "true",
} as const;

/**
 * Conditional import based on feature flag
 */
export function conditionalImport<T>(
  condition: boolean,
  importFn: () => Promise<T>
): Promise<T | null> {
  if (!condition) {
    return Promise.resolve(null);
  }
  return importFn();
}

/**
 * Analyze and report current bundle stats
 */
export function analyzeBundleStats() {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;

  // Get all loaded scripts
  const scripts = Array.from(document.querySelectorAll("script[src]"));
  const totalSize = scripts.reduce((acc, script) => {
    const src = script.getAttribute("src");
    if (!src) return acc;

    // Estimate size from content-length or transfer size
    const resource = performance.getEntriesByName(src)[0] as PerformanceResourceTiming;
    return acc + (resource?.transferSize || 0);
  }, 0);

  console.group("📊 Bundle Analysis");
  console.log(`Total Scripts: ${scripts.length}`);
  console.log(`Total Transfer Size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(
    `First Contentful Paint: ${performance.getEntriesByType("paint")[0]?.startTime.toFixed(2)}ms`
  );
  console.groupEnd();
}

/**
 * Critical CSS inlining helper
 */
export function inlineCriticalCSS(styles: string) {
  if (typeof document === "undefined") return;

  const style = document.createElement("style");
  style.textContent = styles;
  style.setAttribute("data-critical", "true");
  document.head.insertBefore(style, document.head.firstChild);
}
