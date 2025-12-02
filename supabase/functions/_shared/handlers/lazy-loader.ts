/**
 * Lazy Handler Loader
 * Deferred loading of handlers to optimize cold starts
 */

import { logStructuredEvent } from "../observability/index.ts";

// ============================================================================
// TYPES
// ============================================================================

export type HandlerModule = {
  default?: (...args: any[]) => Promise<any>;
  [key: string]: any;
};

export type LazyHandler<T = HandlerModule> = {
  load: () => Promise<T>;
  isLoaded: () => boolean;
  get: () => T | null;
};

// ============================================================================
// LAZY LOADER CLASS
// ============================================================================

class LazyLoader<T> {
  private module: T | null = null;
  private loading: Promise<T> | null = null;
  private loadTime: number = 0;

  constructor(private importFn: () => Promise<T>, private name: string) {}

  /**
   * Check if module is loaded
   */
  isLoaded(): boolean {
    return this.module !== null;
  }

  /**
   * Get loaded module (null if not loaded)
   */
  get(): T | null {
    return this.module;
  }

  /**
   * Get load time in ms
   */
  getLoadTime(): number {
    return this.loadTime;
  }

  /**
   * Load the module
   */
  async load(): Promise<T> {
    if (this.module) {
      return this.module;
    }

    if (this.loading) {
      return this.loading;
    }

    const startTime = performance.now();

    this.loading = this.importFn().then((mod) => {
      this.module = mod;
      this.loadTime = performance.now() - startTime;
      this.loading = null;

      logStructuredEvent("LAZY_LOAD_COMPLETE", {
        module: this.name,
        loadTimeMs: this.loadTime.toFixed(2),
      }, "debug");

      return mod;
    });

    return this.loading;
  }

  /**
   * Preload the module (fire and forget)
   */
  preload(): void {
    if (!this.module && !this.loading) {
      this.load().catch((error) => {
        logStructuredEvent("LAZY_PRELOAD_ERROR", {
          module: this.name,
          error: error instanceof Error ? error.message : String(error),
        }, "warn");
      });
    }
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

const handlerRegistry = new Map<string, LazyLoader<HandlerModule>>();

/**
 * Register a lazy handler
 */
export function registerLazyHandler(
  name: string,
  importFn: () => Promise<HandlerModule>
): void {
  handlerRegistry.set(name, new LazyLoader(importFn, name));
}

/**
 * Get a lazy handler
 */
export async function getLazyHandler(name: string): Promise<HandlerModule | null> {
  const loader = handlerRegistry.get(name);
  if (!loader) {
    logStructuredEvent("LAZY_HANDLER_NOT_FOUND", { name }, "warn");
    return null;
  }
  return loader.load();
}

/**
 * Check if handler is loaded
 */
export function isHandlerLoaded(name: string): boolean {
  return handlerRegistry.get(name)?.isLoaded() ?? false;
}

/**
 * Preload handlers
 */
export function preloadHandlers(names: string[]): void {
  for (const name of names) {
    const loader = handlerRegistry.get(name);
    loader?.preload();
  }
}

/**
 * Get handler loading stats
 */
export function getHandlerLoadingStats(): Record<string, { loaded: boolean; loadTimeMs: number }> {
  const stats: Record<string, { loaded: boolean; loadTimeMs: number }> = {};
  
  for (const [name, loader] of handlerRegistry.entries()) {
    stats[name] = {
      loaded: loader.isLoaded(),
      loadTimeMs: loader.getLoadTime(),
    };
  }
  
  return stats;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a lazy handler function
 */
export function lazy<T extends HandlerModule>(
  name: string,
  importFn: () => Promise<T>
): LazyHandler<T> {
  const loader = new LazyLoader(importFn, name);
  handlerRegistry.set(name, loader as any);

  return {
    load: () => loader.load(),
    isLoaded: () => loader.isLoaded(),
    get: () => loader.get(),
  };
}

/**
 * Execute a handler function lazily
 */
export async function lazyExecute<TArgs extends any[], TResult>(
  handlerName: string,
  functionName: string,
  ...args: TArgs
): Promise<TResult> {
  const module = await getLazyHandler(handlerName);
  if (!module) {
    throw new Error(`Handler ${handlerName} not found`);
  }

  const fn = module[functionName];
  if (typeof fn !== "function") {
    throw new Error(`Function ${functionName} not found in handler ${handlerName}`);
  }

  return fn(...args);
}
