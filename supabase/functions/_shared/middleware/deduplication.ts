/**
 * Request Deduplication Middleware
 * Prevents duplicate message processing
 */

import { MemoryCache } from "../cache/memory-cache.ts";
import { logStructuredEvent } from "../observability/index.ts";

// ============================================================================
// TYPES
// ============================================================================

export type DeduplicationConfig = {
  /** Time window for deduplication in milliseconds */
  windowMs: number;
  /** Maximum entries to track */
  maxEntries: number;
  /** Key extraction function */
  keyExtractor: (req: Request, body: any) => string;
};

export type DeduplicationResult = {
  isDuplicate: boolean;
  key: string;
  firstSeenAt?: number;
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: DeduplicationConfig = {
  windowMs: 30 * 1000, // 30 seconds
  maxEntries: 5000,
  keyExtractor: (_req, body) => {
    // Default: use message ID from WhatsApp
    const messageId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    return messageId || "";
  },
};

// ============================================================================
// DEDUPLICATION CACHE
// ============================================================================

const deduplicationCache = new MemoryCache<{ firstSeenAt: number }>({
  ttlMs: 30 * 1000,
  maxSize: 5000,
});

/**
 * Check if request is a duplicate
 */
export function checkDuplicate(
  key: string,
  config: Partial<DeduplicationConfig> = {}
): DeduplicationResult {
  if (!key) {
    return { isDuplicate: false, key };
  }

  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const existing = deduplicationCache.get(key);

  if (existing) {
    logStructuredEvent("REQUEST_DUPLICATE", { key }, "debug");
    return {
      isDuplicate: true,
      key,
      firstSeenAt: existing.firstSeenAt,
    };
  }

  // Mark as seen
  deduplicationCache.set(key, { firstSeenAt: Date.now() }, fullConfig.windowMs);

  return { isDuplicate: false, key };
}

/**
 * Deduplication middleware
 */
export function deduplicationMiddleware(config: Partial<DeduplicationConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  return async (
    req: Request,
    handler: (req: Request) => Promise<Response>
  ): Promise<Response> => {
    // Only deduplicate POST requests
    if (req.method !== "POST") {
      return handler(req);
    }

    // Clone request to read body
    const clonedReq = req.clone();
    let body: any;

    try {
      body = await clonedReq.json();
    } catch {
      // Not JSON, skip deduplication
      return handler(req);
    }

    // Extract key
    const key = fullConfig.keyExtractor(req, body);
    if (!key) {
      return handler(req);
    }

    // Check for duplicate
    const result = checkDuplicate(key, fullConfig);

    if (result.isDuplicate) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          message: "Request already processed",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Duplicate": "true",
          },
        }
      );
    }

    return handler(req);
  };
}

/**
 * Get deduplication stats
 */
export function getDeduplicationStats() {
  return deduplicationCache.getStats();
}

/**
 * Clear deduplication cache
 */
export function clearDeduplicationCache(): void {
  deduplicationCache.clear();
}
