/**
 * Idempotency utilities for SACCO+ platform
 *
 * Provides helpers for implementing idempotent operations using the ops.idempotency table.
 * This ensures that sensitive operations (payments, transfers, approvals) can be safely
 * retried without duplicate execution.
 *
 * Usage:
 * ```typescript
 * import { withIdempotency } from '@/lib/idempotency';
 *
 * const result = await withIdempotency({
 *   key: 'payment-processing',
 *   userId: user.id,
 *   operation: async () => {
 *     // Your sensitive operation here
 *     return { success: true, transactionId: '123' };
 *   },
 *   ttlMinutes: 30
 * });
 * ```
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/observability/logger";
import crypto from "crypto";

const IDEMPOTENCY_SENTINEL_KEY = "__ibimina_idempotency__" as const;

type IdempotencySentinelType = "pending" | "null" | "undefined";

const createSentinel = (type: IdempotencySentinelType) => ({
  [IDEMPOTENCY_SENTINEL_KEY]: type,
});

const PENDING_SENTINEL = createSentinel("pending");
const NULL_SENTINEL = createSentinel("null");
const UNDEFINED_SENTINEL = createSentinel("undefined");

function isSentinel(
  value: unknown,
  type: IdempotencySentinelType
): value is Record<typeof IDEMPOTENCY_SENTINEL_KEY, IdempotencySentinelType> {
  return (
    typeof value === "object" &&
    value !== null &&
    IDEMPOTENCY_SENTINEL_KEY in value &&
    (value as Record<string, unknown>)[IDEMPOTENCY_SENTINEL_KEY] === type
  );
}

function serializeResponse<T>(value: T): unknown {
  if (value === null) {
    return NULL_SENTINEL;
  }

  if (typeof value === "undefined") {
    return UNDEFINED_SENTINEL;
  }

  return value;
}

function deserializeResponse<T>(value: unknown): T {
  if (isSentinel(value, "null")) {
    return null as T;
  }

  if (isSentinel(value, "undefined")) {
    return undefined as T;
  }

  return value as T;
}

function hasStoredResponse(value: unknown): boolean {
  if (value === null) {
    return false;
  }

  return !isSentinel(value, "pending");
}

type _IdempotencyRecord = {
  response: unknown | null;
  expires_at: string;
  request_hash: string;
};

export interface IdempotencyOptions<T> {
  /** Unique key for the operation type (e.g., 'payment-processing', 'member-approval') */
  key: string;
  /** User ID performing the operation */
  userId: string;
  /** The operation to execute if not already cached */
  operation: () => Promise<T>;
  /** Request payload to hash for uniqueness (optional) */
  requestPayload?: Record<string, unknown>;
  /** Time-to-live in minutes (default: 60) */
  ttlMinutes?: number;
}

export interface IdempotencyResult<T> {
  /** Whether this was a cached result (true) or newly executed (false) */
  fromCache: boolean;
  /** The result of the operation */
  data: T;
}

/**
 * Generate a hash of the request payload for idempotency checking
 */
function hashRequest(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Execute an operation with idempotency protection
 *
 * If a matching idempotency record exists and hasn't expired, returns the cached result.
 * Otherwise, executes the operation, stores the result, and returns it.
 *
 * Note: The idempotency table has a composite primary key of (user_id, key).
 * The request_hash is stored but not part of the unique constraint, so ensure your
 * key is unique per operation type to avoid collisions.
 */
export async function withIdempotency<T>({
  key,
  userId,
  operation,
  requestPayload,
  ttlMinutes = 60,
}: IdempotencyOptions<T>): Promise<IdempotencyResult<T>> {
  const supabase = await createSupabaseServerClient();
  const requestHash = requestPayload ? hashRequest(requestPayload) : "";
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const pollIntervalMs = 200;
  const maxAttempts = 50; // ~10 seconds total wait for concurrent executions
  let lockAcquired = false;

  try {
    const tryInsertLock = async () => {
      const { data, error } = await supabase
        .from("idempotency")
        .insert(
          {
            key,
            user_id: userId,
            request_hash: requestHash,
            response: PENDING_SENTINEL,
            expires_at: expiresAt,
          },
          { returning: "representation" }
        )
        .select("request_hash")
        .maybeSingle();

      if (!error && data) {
        return { status: "acquired" as const };
      }

      if (error) {
        if (error.code === "23505" || error.details?.includes("duplicate key")) {
          return { status: "conflict" as const };
        }

        throw error;
      }

      return { status: "conflict" as const };
    };

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const handleCachedResponse = async () => {
      const { data: existing, error: fetchError } = await supabase
        .from("idempotency")
        .select("response, expires_at, request_hash")
        .eq("key", key)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!existing) {
        return { status: "retry" as const };
      }

      const isExpired = new Date(existing.expires_at) < new Date();
      const hashMatches = existing.request_hash === requestHash;
      const hasResponse = hasStoredResponse(existing.response);

      if (hashMatches && hasResponse && !isExpired) {
        return {
          status: "cached" as const,
          data: deserializeResponse<T>(existing.response),
        };
      }

      if (hashMatches && !hasResponse && !isExpired) {
        return { status: "wait" as const };
      }

      if (!hashMatches) {
        logError("idempotency_hash_mismatch", {
          key,
          userId,
          expected: requestHash,
          actual: existing.request_hash,
        });
      }

      if (isExpired || !hashMatches) {
        const { data: updated, error: updateError } = await supabase
          .from("idempotency")
          .update({
            request_hash: requestHash,
            expires_at: expiresAt,
            response: PENDING_SENTINEL,
          })
          .eq("key", key)
          .eq("user_id", userId)
          .eq("request_hash", existing.request_hash)
          .select("request_hash")
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }

        if (updated) {
          return { status: "acquired" as const };
        }
      }

      return { status: "wait" as const };
    };

    const initialLock = await tryInsertLock();

    if (initialLock.status === "acquired") {
      lockAcquired = true;
    } else {
      let attempts = 0;

      while (attempts < maxAttempts) {
        const cachedResult = await handleCachedResponse();

        if (cachedResult.status === "cached") {
          return {
            fromCache: true,
            data: cachedResult.data,
          };
        }

        if (cachedResult.status === "acquired") {
          lockAcquired = true;
          break;
        }

        attempts += 1;

        if (cachedResult.status === "retry") {
          const retryLock = await tryInsertLock();

          if (retryLock.status === "acquired") {
            lockAcquired = true;
            break;
          }

          continue;
        }

        await wait(pollIntervalMs);
      }
    }

    if (!lockAcquired) {
      throw new Error("Failed to acquire idempotency lock");
    }

    const result = await operation();

    const { error: storeError } = await supabase
      .from("idempotency")
      .update({
        response: serializeResponse(result),
        expires_at: expiresAt,
      })
      .eq("key", key)
      .eq("user_id", userId)
      .eq("request_hash", requestHash);

    if (storeError) {
      logError("idempotency_store_failed", {
        key,
        userId,
        error: storeError,
      });
      const { error: releaseError } = await supabase
        .from("idempotency")
        .delete()
        .eq("key", key)
        .eq("user_id", userId)
        .eq("request_hash", requestHash);

      if (releaseError) {
        logError("idempotency_release_failed", {
          key,
          userId,
          error: releaseError,
        });
      }
      // Continue anyway - the operation succeeded
    }

    return {
      fromCache: false,
      data: result,
    };
  } catch (error) {
    logError("idempotency_operation_failed", {
      key,
      userId,
      error,
    });
    if (lockAcquired) {
      const { error: cleanupError } = await supabase
        .from("idempotency")
        .delete()
        .eq("key", key)
        .eq("user_id", userId)
        .eq("request_hash", requestHash);

      if (cleanupError) {
        logError("idempotency_cleanup_failed", {
          key,
          userId,
          error: cleanupError,
        });
      }
    }
    throw error;
  }
}

/**
 * Manually invalidate an idempotency record
 *
 * Use this when you need to allow an operation to be re-executed
 * (e.g., after a failed payment that needs to be retried)
 */
export async function invalidateIdempotency({
  key,
  userId,
}: {
  key: string;
  userId: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase
      .from("idempotency" as any)
      .delete()
      .eq("key", key)
      .eq("user_id", userId);

    if (error) {
      logError("idempotency_invalidate_failed", {
        key,
        userId,
        error,
      });
    }
  } catch (error) {
    logError("idempotency_invalidate_error", {
      key,
      userId,
      error,
    });
  }
}

/**
 * Clean up expired idempotency records
 *
 * This should be run periodically (e.g., via cron) to prevent the table from growing unbounded
 */
export async function cleanupExpiredIdempotency(): Promise<{
  deleted: number;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  try {
    const { error, count } = await supabase
      .from("idempotency" as any)
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      return {
        deleted: 0,
        error: error.message,
      };
    }

    return {
      deleted: count ?? 0,
    };
  } catch (error) {
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
