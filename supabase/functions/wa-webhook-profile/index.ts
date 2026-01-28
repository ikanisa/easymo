/// <reference types="https://deno.land/x/types/index.d.ts" />

/**
 * WhatsApp Profile Management Webhook Handler
 *
 * Handles user profile management via WhatsApp Business API:
 * - QR Code generation
 * - Wallet & Tokens (balance, earn by sharing, transfer to partners)
 *
 * Features:
 * - Circuit breaker protection for database operations
 * - Response caching for webhook retries (2-min TTL)
 * - Connection pooling for Supabase client
 * - Keep-alive headers for connection reuse
 * - Atomic idempotency checking
 *
 * @module wa-webhook-profile
 * @version 3.0.0
 */

import { createClient } from "@supabase/supabase-js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { maskPhone } from "../_shared/phone-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { isValidInternalForward } from "../_shared/security/internal-forward.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import type {
  RouterContext,
  WhatsAppInteractiveMessage,
  WhatsAppTextMessage,
  WhatsAppWebhookPayload,
} from "../_shared/wa-webhook-shared/types.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";
import { sendTextMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import {
  checkIdempotency,
  verifyWebhookSignature,
} from "../_shared/webhook-utils.ts";
import { classifyError, formatUnknownError } from "./utils/error-handling.ts";

const profileConfig = WEBHOOK_CONFIG.profile;

const SERVICE_NAME = "wa-webhook-profile";
const SERVICE_VERSION = "3.0.0";
const MAX_BODY_SIZE = profileConfig.maxBodySize;
// Make cache size configurable via environment variable (P2-003 fix)
const MAX_CACHE_SIZE = parseInt(
  Deno.env.get("PROFILE_CACHE_MAX_SIZE") || 
  Deno.env.get("WA_CACHE_MAX_SIZE") || 
  "1000",
  10
); // Maximum number of cached responses to prevent memory leaks

// Circuit breaker for database operations
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  windowSize: 60000,
});

// Simple response cache for recent requests (helps with webhook retries)
// Uses LRU-style eviction: oldest entries are removed first when at capacity
interface CacheEntry {
  response: { success: boolean; ignored?: string };
  timestamp: number;
  lastAccessed: number; // For LRU tracking
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 120000; // 2 minutes
const CACHE_CLEANUP_INTERVAL = 30000; // 30 seconds (improved from 60s)

// Helper function to evict oldest entries (LRU)
function evictOldestEntries(targetSize: number) {
  if (responseCache.size <= targetSize) return;
  
  const entries = Array.from(responseCache.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed); // Sort by last accessed time
  
  const toRemove = entries.slice(0, responseCache.size - targetSize);
  for (const [key] of toRemove) {
    responseCache.delete(key);
  }
  
  logStructuredEvent("PROFILE_CACHE_EVICTED", {
    evictedCount: toRemove.length,
    remainingSize: responseCache.size,
    targetSize,
  }, "info");
}

// Cleanup old cache entries periodically and enforce size limit
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  // Remove expired entries
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      responseCache.delete(key);
      expiredCount++;
    }
  }
  
  // Enforce size limit using LRU eviction
  if (responseCache.size > MAX_CACHE_SIZE) {
    evictOldestEntries(MAX_CACHE_SIZE);
  }
  
  // Log cache stats periodically (every 5 minutes)
  if (Math.random() < 0.1) { // ~10% chance per cleanup cycle = ~every 5 minutes
    logStructuredEvent("PROFILE_CACHE_STATS", {
      size: responseCache.size,
      maxSize: MAX_CACHE_SIZE,
      expiredCount,
      utilizationPercent: Math.round((responseCache.size / MAX_CACHE_SIZE) * 100),
    });
  }
}, CACHE_CLEANUP_INTERVAL);

// Environment variable validation at startup
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Track if environment is valid for health check reporting
const envValid = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (!envValid) {
  const missingVars = [
    !SUPABASE_URL ? "SUPABASE_URL" : null,
    !SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter(Boolean);

  logStructuredEvent("PROFILE_ENV_VALIDATION_FAILED", {
    service: SERVICE_NAME,
    missingVars,
  }, "error");

  // In production, throw to prevent starting with invalid config
  const runtimeEnv = (Deno.env.get("APP_ENV") ??
    Deno.env.get("DENO_ENV") ??
    Deno.env.get("NODE_ENV") ??
    Deno.env.get("ENVIRONMENT") ??
    "development").toLowerCase();
  if (runtimeEnv === "production" || runtimeEnv === "prod") {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }
}

const supabase = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-connection-pool": "true",
      },
    },
    auth: {
      persistSession: false, // Edge functions don't need session persistence
      autoRefreshToken: false,
    },
  },
);

function isAuthorizedCoreForward(req: Request): boolean {
  const routedFrom = req.headers.get("x-routed-from") ?? req.headers.get("X-Routed-From");
  if (routedFrom !== "wa-webhook-core") return false;

  const auth = req.headers.get("authorization");
  if (!auth) return false;

  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();
  if (!token) return false;

  return Boolean(SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Handle referral code application (automatic earning)
 * Called when a new user sends a referral code
 */
async function handleReferralCode(
  ctx: RouterContext,
  code: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Apply referral code using RPC function
    const { data, error } = await ctx.supabase.rpc("referral_apply_code_v2", {
      _joiner_profile_id: ctx.profileId,
      _joiner_whatsapp: ctx.from,
      _code: code,
      _idempotency_key: `ref_${ctx.profileId}_${code}_${Date.now()}`,
    });

    if (error) {
      await logStructuredEvent("REFERRAL_APPLY_ERROR", {
        userId: ctx.profileId,
        code,
        error: error.message,
      }, "error");
      await sendTextMessage(ctx, "⚠️ Invalid referral code. Please try again.");
      return true;
    }

    const result = Array.isArray(data) ? data[0] : data;
    
    if (!result?.applied) {
      // Code invalid or already used
      const reason = result?.reason || "unknown";
      if (reason === "already_attributed" || reason === "existing_user") {
        await sendTextMessage(
          ctx,
          "✅ Welcome to easyMO! You're already registered. Send 'menu' to get started.",
        );
      } else {
        await sendTextMessage(ctx, "⚠️ Invalid referral code. Please check and try again.");
      }
      return true;
    }

    // Success - tokens credited
    const tokensAwarded = result.tokens_awarded || 10;
    const promoterWhatsapp = result.promoter_whatsapp;

    // Send welcome message to joiner
    await sendTextMessage(
      ctx,
      `🎉 Welcome to easyMO!\n\nYou've been referred by a friend. Send 'menu' to explore our services.`,
    );

    // Send notification to referrer (if we have their WhatsApp)
    if (promoterWhatsapp) {
      try {
        await sendText(
          promoterWhatsapp,
          `🎉 You earned *${tokensAwarded} tokens* because ${maskPhone(ctx.from)} started using easyMO.`,
        );
      } catch {
        // Non-fatal - notification failed but credit succeeded
      }
    }

    await logStructuredEvent("REFERRAL_APPLIED_SUCCESS", {
      joinerId: ctx.profileId,
      promoterId: result.promoter_profile_id,
      tokensAwarded,
      code,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("REFERRAL_APPLY_EXCEPTION", {
      userId: ctx.profileId,
      code,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendTextMessage(ctx, "⚠️ Error processing referral code. Please try again.");
    return true;
  }
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;
  const isReferralFlow = (req.headers.get("x-wa-referral-flow") ?? "false")
    .toLowerCase() === "true";

  // Helper: JSON response with consistent headers
  const json = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    headers.set("X-Service-Version", SERVICE_VERSION);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Helper: Structured logging
  const logEvent = (
    event: string,
    payload: Record<string, unknown> = {},
    level: "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: SERVICE_NAME,
      requestId,
      correlationId,
      ...payload,
    }, level);
  };

  // Health check endpoint - Include circuit breaker metrics
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const healthStatus = envValid ? "healthy" : "degraded";
    return json({
      status: healthStatus,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      circuitBreaker: dbCircuitBreaker.getMetrics(),
      cacheSize: responseCache.size,
      maxCacheSize: MAX_CACHE_SIZE,
      cacheUtilizationPercent: Math.round((responseCache.size / MAX_CACHE_SIZE) * 100),
      cacheCleanupInterval: CACHE_CLEANUP_INTERVAL,
      envValid,
    });
  }

  // WhatsApp webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN") ??
      Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token && token === verifyToken) {
      logEvent("PROFILE_WEBHOOK_VERIFIED", { mode });
      return new Response(challenge ?? "", {
        status: 200,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
        },
      });
    }

    logEvent(
      "PROFILE_VERIFICATION_FAILED",
      { mode, hasToken: !!token },
      "warn",
    );
    return json({ error: "forbidden", message: "Invalid verification token" }, {
      status: 403,
    });
  }

  // POST webhook handling
  try {
    // Rate limiting check (P0 fix - Issue #1)
    const rateLimitResult = await rateLimitMiddleware(req, {
      limit: profileConfig.rateLimit,
      windowSeconds: profileConfig.rateWindow,
    });

    if (!rateLimitResult.allowed) {
      logEvent("PROFILE_RATE_LIMITED", {
        remaining: rateLimitResult.result.remaining,
        resetAt: rateLimitResult.result.resetAt.toISOString(),
      }, "warn");
      return rateLimitResult.response!;
    }

    // Parse request body
    const rawBody = await req.text();

    // Body size validation (P0 fix - Issue #2)
    if (rawBody.length > MAX_BODY_SIZE) {
      logEvent("PROFILE_PAYLOAD_TOO_LARGE", {
        size: rawBody.length,
        max: MAX_BODY_SIZE,
      }, "warn");
      return json({
        error: "payload_too_large",
        message: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`,
        max_size: MAX_BODY_SIZE,
      }, { status: 413 });
    }

    let payload: WhatsAppWebhookPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      logEvent("PROFILE_PARSE_ERROR", {
        error: parseError instanceof Error
          ? parseError.message
          : String(parseError),
      }, "error");
      return json({ error: "invalid_json", message: "Invalid JSON payload" }, {
        status: 400,
      });
    }

    // Verify webhook signature (security)
    const appSecret = Deno.env.get("WA_APP_SECRET") ??
      Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const runtimeEnv = (Deno.env.get("APP_ENV") ??
      Deno.env.get("DENO_ENV") ??
      Deno.env.get("NODE_ENV") ??
      Deno.env.get("ENVIRONMENT") ??
      "development").toLowerCase();
    const isProduction = runtimeEnv === "production" || runtimeEnv === "prod";
    const allowUnsigned = !isProduction &&
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";

    // Allow internal forwards from wa-webhook-core (raw body is re-stringified so signature won't match)
    const isInternalForward = isValidInternalForward(req) || isAuthorizedCoreForward(req);
    if (isInternalForward) {
      logEvent("PROFILE_INTERNAL_FORWARD_ACCEPTED", {
        hasForwardToken: req.headers.has("x-wa-internal-forward-token"),
        hasAuthorization: req.headers.has("authorization"),
      });
    }

    // Fix signature verification logic gap: prod requires signature+secret; dev only bypasses if explicitly allowed
    if (isProduction && !isInternalForward) {
      if (!signature || !appSecret) {
        logEvent("PROFILE_SIGNATURE_MISSING", {
          environment: "production",
          hasSignature: !!signature,
          hasAppSecret: !!appSecret,
        }, "error");
        return json({
          error: "unauthorized",
          message: "Missing webhook signature or app secret",
        }, { status: 401 });
      }

      const isValid = await verifyWebhookSignature(
        rawBody,
        signature,
        appSecret,
      );
      if (!isValid) {
        logEvent("PROFILE_SIGNATURE_INVALID", {
          environment: runtimeEnv,
          userAgent: req.headers.get("user-agent"),
        }, "error");
        return json({
          error: "unauthorized",
          message: "Invalid webhook signature",
        }, { status: 401 });
      }
    } else if (!isInternalForward) {
      if (signature && appSecret) {
        const isValid = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
        if (!isValid) {
          if (!allowUnsigned) {
            logEvent(
              "PROFILE_SIGNATURE_INVALID_DEV",
              { bypass_disabled: true },
              "warn",
            );
            return json({
              error: "unauthorized",
              message: "Invalid signature (dev bypass disabled)",
            }, { status: 401 });
          }
          logEvent("PROFILE_SIGNATURE_BYPASS_DEV", {
            reason: "dev_mode_explicit",
          }, "warn");
        }
      } else if (signature && !appSecret) {
        logEvent("PROFILE_SIGNATURE_NO_SECRET", {
          environment: runtimeEnv,
          hasSignature: true,
        }, "warn");
      }
    }

    // Validate payload structure
    if (
      !payload.entry || !Array.isArray(payload.entry) ||
      payload.entry.length === 0
    ) {
      logEvent("PROFILE_NO_ENTRIES", {}, "info");
      return json({ success: true, ignored: "no_entries" });
    }

    const entry = payload.entry[0];
    if (
      !entry.changes || !Array.isArray(entry.changes) ||
      entry.changes.length === 0
    ) {
      logEvent("PROFILE_NO_CHANGES", {}, "info");
      return json({ success: true, ignored: "no_changes" });
    }

    const change = entry.changes[0];
    const value = change?.value;

    if (!value) {
      logEvent("PROFILE_NO_VALUE", {}, "info");
      return json({ success: true, ignored: "no_value" });
    }

    if (
      !value.messages || !Array.isArray(value.messages) ||
      value.messages.length === 0
    ) {
      logEvent("PROFILE_NO_MESSAGES", {}, "info");
      return json({ success: true, ignored: "no_messages" });
    }

    const message = value.messages[0];
    const from = message?.from;
    const messageId = message?.id;

    if (!from || !messageId) {
      logEvent("PROFILE_MISSING_MESSAGE_FIELDS", {
        hasFrom: !!from,
        hasMessageId: !!messageId,
      }, "warn");
      return json({ success: true, ignored: "missing_fields" });
    }

    logEvent("PROFILE_WEBHOOK_RECEIVED", {
      from: from.slice(-4),
      messageId: messageId.slice(0, 8),
      type: message.type,
    });

    // Check response cache (helps with webhook retries from WhatsApp)
    const cacheKey = `${from}:${messageId}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Update last accessed time for LRU tracking
      cached.lastAccessed = Date.now();
      
      logEvent(
        "PROFILE_CACHE_HIT",
        { messageId: messageId?.slice(0, 8) },
        "info",
      );
      return json(cached.response);
    }

    // Database idempotency check (P0 fix - Issue #3)
    // Check if message has already been processed
    if (messageId) {
      try {
        const alreadyProcessed = await checkIdempotency(
          supabase,
          messageId,
          correlationId,
          from, // Pass phone number for wa_events table
        );
        if (alreadyProcessed) {
          logEvent("PROFILE_DUPLICATE_SKIPPED", {
            messageId: messageId.slice(0, 8),
          }, "info");
          return json({ success: true, ignored: "duplicate" });
        }
      } catch (idempotencyError) {
        // Log but don't fail - idempotency check failure shouldn't block processing
        // Properly serialize error (handle Supabase error objects)
        const errorMessage = idempotencyError instanceof Error
          ? idempotencyError.message
          : (idempotencyError && typeof idempotencyError === "object" &&
              "message" in idempotencyError)
          ? String((idempotencyError as Record<string, unknown>).message)
          : String(idempotencyError);

        logEvent("PROFILE_IDEMPOTENCY_CHECK_ERROR", {
          error: errorMessage,
          errorCode:
            (idempotencyError && typeof idempotencyError === "object" &&
                "code" in idempotencyError)
              ? String((idempotencyError as Record<string, unknown>).code)
              : undefined,
        }, "warn");
      }
    }

    // Build Context - Auto-create profile if needed (with circuit breaker protection)
    if (!dbCircuitBreaker.canExecute()) {
      logEvent("PROFILE_DB_CIRCUIT_OPEN", {
        from: from?.slice(-4),
        metrics: dbCircuitBreaker.getMetrics(),
      }, "warn");
      return json(
        {
          error: "service_unavailable",
          message: "Database temporarily unavailable",
          retry_after: 60,
        },
        { status: 503 },
      );
    }

    let profile;
    try {
      profile = await ensureProfile(supabase, from);
      dbCircuitBreaker.recordSuccess();
      
      // If profile is null, it means we couldn't create/find the profile
      // This is a system error, not a user error
      if (!profile) {
        logEvent("PROFILE_NOT_FOUND_OR_CREATED", {
          from: from?.slice(-4),
        }, "error");
        return json({
          error: "internal_error",
          message: "Failed to process profile",
        }, { status: 500 });
      }
    } catch (error) {
      dbCircuitBreaker.recordFailure(
        error instanceof Error ? error.message : String(error),
      );

      const errorMessage = formatUnknownError(error);

      // Classify error type
      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("duplicate")
      ) {
        // User error - phone already exists (return 400, not 500)
        logEvent("PROFILE_USER_ERROR", {
          error: "PHONE_DUPLICATE",
          from: from?.slice(-4),
        }, "warn");
        return json({
          error: "USER_ERROR",
          code: "PHONE_DUPLICATE",
          message: "Phone number already registered",
        }, { status: 400 });
      }

      // System error - database issue (return 500)
      logEvent("PROFILE_SYSTEM_ERROR", {
        error: errorMessage,
        from: from?.slice(-4),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      }, "error");
      return json({
        error: "internal_error",
        message: "Failed to process profile",
      }, { status: 500 });
    }

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: "en", // Profile service uses hardcoded English strings, no translations
    };

    // Get State (with error handling)
    let state = null;
    if (ctx.profileId) {
      try {
        state = await getState(supabase, ctx.profileId);
      } catch (error) {
        // Log but continue - state fetch failure shouldn't block processing
        logEvent("PROFILE_STATE_FETCH_ERROR", {
          userId: ctx.profileId,
          error: error instanceof Error ? error.message : String(error),
        }, "warn");
      }
    }

    let handled = false;

    // Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactiveMessage = message as WhatsAppInteractiveMessage;
      const interactive = interactiveMessage.interactive;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {
        // Profile Home
        if (id === "profile" || id === "PROFILE") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        // MoMo QR Code
        else if (id === IDS.MOMO_QR || id === "MOMO_QR") {
          const { handleMomoQr } = await import("./handlers/momo-qr.ts");
          handled = await handleMomoQr(ctx, "", state ?? { key: "", data: {} });
        }
        // Wallet (Transfer Tokens)
        else if (id === "WALLET" || id === "wallet") {
          const { handleWallet } = await import("./handlers/wallet.ts");
          handled = await handleWallet(ctx, "", state ?? { key: "", data: {} });
        }
        // Share EasyMO
        else if (id === IDS.SHARE_EASYMO || id === "SHARE_EASYMO") {
          const { handleShareEasyMO } = await import("./handlers/share.ts");
          handled = await handleShareEasyMO(ctx);
        }
        // MoMo QR choice buttons
        else if (id === IDS.MOMO_QR_MY || id === IDS.MOMO_QR_NUMBER || id === IDS.MOMO_QR_CODE) {
          const { handleMomoQr } = await import("./handlers/momo-qr.ts");
          handled = await handleMomoQr(ctx, id, state ?? { key: "MOMO_WAIT_CHOICE", data: {} });
        }
        // Back to Profile
        else if (id === IDS.PROFILE || id === "PROFILE") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        // Back to Menu
        else if (id === IDS.BACK_MENU || id === "back_menu") {
          // Return to core home menu - send empty response to let core handle it
          handled = true;
        }
      }
    }     // Handle Text Messages
    else if (message.type === "text") {
      const textMessage = message as WhatsAppTextMessage;
      const text = textMessage.text?.body?.trim() ?? "";
      const lowerText = text.toLowerCase();
      const upperText = text.toUpperCase();

      // Only treat pure numeric inputs (with separators) as MoMo inputs.
      // This avoids misclassifying normal text as MoMo values.
      const looksLikeMomoInput =
        /^[0-9+()\s-]+$/.test(text) && text.replace(/\D/g, "").length >= 4;

      // Referral flow (ONLY when explicitly routed from wa-webhook-core on a new user's FIRST message)
      // If this flag is set, it means router confirmed: new user + first message + referral code detected
      // If flag is NOT set, NEVER process referral codes - user is not new or not first message
      if (isReferralFlow) {
        // Extract referral code from text (already validated by router)
        const refMatch = text.match(
          /^(?:EASYMO\s+)?REF[:\s]+([A-Z0-9]{4,12})$/i,
        );
        const isStandaloneCode = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,12}$/.test(
          upperText,
        );
        if (refMatch || isStandaloneCode) {
          const code = refMatch ? refMatch[1].toUpperCase() : upperText;
          handled = await handleReferralCode(ctx, code);
        }
      }
      // NOTE: If isReferralFlow is false, we intentionally skip referral code processing
      // This ensures referral codes are ONLY processed for new users on their first message

      // PRIORITY: MoMo flows (state or numeric input) before other commands
      if (state?.key === "MOMO_WAIT_CHOICE" || state?.key === "MOMO_WAIT_VALUE") {
        const { handleMomoQr } = await import("./handlers/momo-qr.ts");
        handled = await handleMomoQr(ctx, text, state);
      } else if (!handled && looksLikeMomoInput) {
        const { handleMomoQr } = await import("./handlers/momo-qr.ts");
        handled = await handleMomoQr(ctx, text, state ?? { key: "MOMO_WAIT_VALUE", data: {} });
      }
      // Profile menu
      if (!handled && lowerText === "profile") {
        const { startProfile } = await import("./handlers/menu.ts");
        handled = await startProfile(ctx, state ?? { key: "home" });
      }
      // Wallet - handle state-based input
      else if (!handled && (state?.key === "WALLET_WAIT_NUMBER" || state?.key === "WALLET_WAIT_AMOUNT")) {
        const { handleWallet } = await import("./handlers/wallet.ts");
        handled = await handleWallet(ctx, text, state);
      }
      // MoMo QR keyword
      else if (!handled && (lowerText.includes("momo") || lowerText.includes("qr"))) {
        const { handleMomoQr } = await import("./handlers/momo-qr.ts");
        handled = await handleMomoQr(ctx, "", state ?? { key: "", data: {} });
      }
      // Wallet keyword
      else if (!handled && (lowerText.includes("wallet") || lowerText.includes("transfer"))) {
        const { handleWallet } = await import("./handlers/wallet.ts");
        handled = await handleWallet(ctx, "", state ?? { key: "", data: {} });
      }
    }

    // Fallback: Detect phone number pattern (for MoMo QR without keywords)
    if (!handled && message.type === "text") {
      const fallbackTextMessage = message as WhatsAppTextMessage;
      const text = fallbackTextMessage.text?.body?.trim() ?? "";
      const looksLikeMomoInput =
        /^[0-9+()\s-]+$/.test(text) && text.replace(/\D/g, "").length >= 4;
      if (looksLikeMomoInput) {
        // Looks like a MoMo input, treat as MoMo QR input
        const { handleMomoQr } = await import("./handlers/momo-qr.ts");
        handled = await handleMomoQr(ctx, text, state ?? { key: "MOMO_WAIT_VALUE", data: {} });
      }
    }

    if (!handled) {
      logEvent("PROFILE_UNHANDLED_MESSAGE", {
        from: maskPhone(from),
        type: message.type,
        requestId,
        correlationId,
        profileId: ctx.profileId,
      });
    }

    // Cache successful response with LRU tracking
    const successResponse = { success: true, handled };
    if (messageId) {
      const now = Date.now();
      
      // Evict oldest entries if at capacity before adding new entry
      if (responseCache.size >= MAX_CACHE_SIZE) {
        evictOldestEntries(MAX_CACHE_SIZE - 1);
      }
      
      responseCache.set(cacheKey, {
        response: successResponse,
        timestamp: now,
        lastAccessed: now,
      });
    }

    return json(successResponse);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Classify error type
    const { isUserError, isSystemError, statusCode } = classifyError(err);

    // Single consolidated error log
    logEvent(
      "PROFILE_WEBHOOK_ERROR",
      {
        path: url.pathname,
        error: errorMessage,
        stack: errorStack,
        errorType: isUserError
          ? "user_error"
          : (isSystemError ? "system_error" : "unknown_error"),
        statusCode,
        requestId,
        correlationId,
      },
      isSystemError ? "error" : "warn",
    );

    return json(
      {
        error: isUserError
          ? "invalid_request"
          : (isSystemError ? "service_unavailable" : "internal_error"),
        message: isUserError
          ? errorMessage
          : "An unexpected error occurred. Please try again later.",
        service: SERVICE_NAME,
        requestId,
      },
      {
        status: statusCode,
      },
    );
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: SERVICE_NAME,
  version: SERVICE_VERSION,
});
