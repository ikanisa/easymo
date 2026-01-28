/**
 * Warm-up Module
 * Optimizes cold start times through preloading
 */

import { getCachedAppConfig } from "../cache/index.ts";
import { getClientPool } from "../database/client-pool.ts";
import { preloadHandlers } from "../handlers/lazy-loader.ts";
import { logStructuredEvent } from "../observability/index.ts";

// ============================================================================
// TYPES
// ============================================================================

export type WarmupConfig = {
  /** Preload database connection */
  preloadDatabase: boolean;
  /** Preload app configuration */
  preloadConfig: boolean;
  /** Handler names to preload */
  preloadHandlerNames: string[];
  /** Timeout for warmup in ms */
  timeoutMs: number;
};

export type WarmupResult = {
  success: boolean;
  durationMs: number;
  steps: {
    name: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }[];
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_WARMUP_CONFIG: WarmupConfig = {
  preloadDatabase: true,
  preloadConfig: true,
  preloadHandlerNames: [],
  timeoutMs: 5000,
};

// ============================================================================
// WARMUP FUNCTIONS
// ============================================================================

/**
 * Run warmup sequence
 */
export async function warmup(config: Partial<WarmupConfig> = {}): Promise<WarmupResult> {
  const fullConfig = { ...DEFAULT_WARMUP_CONFIG, ...config };
  const startTime = performance.now();
  const steps: WarmupResult["steps"] = [];

  logStructuredEvent("WARMUP_START", { config: fullConfig });

  // Database warmup
  if (fullConfig.preloadDatabase) {
    const stepStart = performance.now();
    try {
      const pool = getClientPool();
      pool.acquire(); // Trigger client creation
      steps.push({
        name: "database",
        success: true,
        durationMs: performance.now() - stepStart,
      });
    } catch (error) {
      steps.push({
        name: "database",
        success: false,
        durationMs: performance.now() - stepStart,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Config warmup
  if (fullConfig.preloadConfig) {
    const stepStart = performance.now();
    try {
      const pool = getClientPool();
      await getCachedAppConfig(pool.acquire());
      steps.push({
        name: "config",
        success: true,
        durationMs: performance.now() - stepStart,
      });
    } catch (error) {
      steps.push({
        name: "config",
        success: false,
        durationMs: performance.now() - stepStart,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Handler warmup
  if (fullConfig.preloadHandlerNames.length > 0) {
    const stepStart = performance.now();
    try {
      preloadHandlers(fullConfig.preloadHandlerNames);
      steps.push({
        name: "handlers",
        success: true,
        durationMs: performance.now() - stepStart,
      });
    } catch (error) {
      steps.push({
        name: "handlers",
        success: false,
        durationMs: performance.now() - stepStart,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalDuration = performance.now() - startTime;
  const allSuccess = steps.every((s) => s.success);

  logStructuredEvent(allSuccess ? "WARMUP_COMPLETE" : "WARMUP_PARTIAL", {
    durationMs: totalDuration,
    steps: steps.map((s) => ({ name: s.name, success: s.success })),
  });

  return {
    success: allSuccess,
    durationMs: totalDuration,
    steps,
  };
}

/**
 * Background warmup (fire and forget)
 */
export function backgroundWarmup(config: Partial<WarmupConfig> = {}): void {
  // Run warmup in background, don't block
  warmup(config).catch((error) => {
    logStructuredEvent("WARMUP_BACKGROUND_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
  });
}

/**
 * Warmup on first request
 */
let hasWarmedUp = false;

export async function warmupOnce(config: Partial<WarmupConfig> = {}): Promise<void> {
  if (hasWarmedUp) return;
  
  await warmup(config);
  hasWarmedUp = true;
}

/**
 * Check if warmup has completed
 */
export function isWarmedUp(): boolean {
  return hasWarmedUp;
}
