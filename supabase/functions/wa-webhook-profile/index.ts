/**
 * WhatsApp Profile Management Webhook Handler
 *
 * Handles user profile management via WhatsApp Business API:
 * - Language preferences
 * - Location settings
 * - Profile information
 * - Help and support
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import type {
  RouterContext,
  WhatsAppWebhookPayload,
} from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
import {
  checkIdempotency,
  verifyWebhookSignature,
} from "../_shared/webhook-utils.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { classifyError, formatUnknownError } from "./utils/error-handling.ts";
import { parseCoordinates } from "./utils/coordinates.ts";
import { sendTextMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { maskPhone } from "../_shared/phone-utils.ts";
import type { SupportedLanguage } from "../_shared/wa-webhook-shared/i18n/language.ts";
import type {
  WhatsAppInteractiveMessage,
  WhatsAppTextMessage,
  WhatsAppLocationMessage,
} from "../_shared/wa-webhook-shared/types.ts";

const profileConfig = WEBHOOK_CONFIG.profile;

const SERVICE_NAME = "wa-webhook-profile";
const SERVICE_VERSION = "3.0.0";
const MAX_BODY_SIZE = profileConfig.maxBodySize;
const MAX_CACHE_SIZE = 1000; // Maximum number of cached responses to prevent memory leaks

// Circuit breaker for database operations
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  windowSize: 60000,
});

// Simple response cache for recent requests (helps with webhook retries)
interface CacheEntry {
  response: { success: boolean; ignored?: string };
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 120000; // 2 minutes

// Cleanup old cache entries periodically and enforce size limit
setInterval(() => {
  const now = Date.now();
  // Remove expired entries
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
  // Enforce size limit by removing oldest entries if needed
  if (responseCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(responseCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, responseCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      responseCache.delete(key);
    }
  }
}, 60000); // Cleanup every minute

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
  const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
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

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

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
      envValid,
    });
  }

  // WhatsApp webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN");

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
    const appSecret = Deno.env.get("WA_APP_SECRET") ?? "";
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development")
      .toLowerCase();
    const isProduction = runtimeEnv === "production" || runtimeEnv === "prod";

    // Fix signature verification logic gap (P1 fix - Issue #8)
    // If appSecret is configured, always require a valid signature in production
    // If signature is present, always verify it regardless of environment
    if (isProduction) {
      if (!signature || !appSecret) {
        // Production must have both signature and secret
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
    } else {
      // Non-production environment
      if (signature && appSecret) {
        // If both are provided, verify
        const isValid = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
        if (!isValid) {
          const allowBypass =
            Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") === "true";
          if (!allowBypass) {
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
        // Signature provided but no secret to verify against - log warning
        logEvent("PROFILE_SIGNATURE_NO_SECRET", {
          environment: runtimeEnv,
          hasSignature: true,
        }, "warn");
      }
      // If neither signature nor secret, allow in non-production (dev mode)
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
    const value = change.value;

    if (
      !value.messages || !Array.isArray(value.messages) ||
      value.messages.length === 0
    ) {
      logEvent("PROFILE_NO_MESSAGES", {}, "info");
      return json({ success: true, ignored: "no_messages" });
    }

    const message = value.messages[0];
    const from = message.from;
    const messageId = message.id;

    logEvent("PROFILE_WEBHOOK_RECEIVED", {
      from: from?.slice(-4),
      messageId: messageId?.slice(0, 8),
      type: message.type,
    });

    // Check response cache (helps with webhook retries from WhatsApp)
    const cacheKey = `${from}:${messageId}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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
      locale: (profile?.language as SupportedLanguage) || "en",
    };

    // Get State
    const state = ctx.profileId
      ? await getState(supabase, ctx.profileId)
      : null;

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
        if (id === "profile") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        } // Profile Edit
        else if (id === "EDIT_PROFILE" || id === "edit_profile") {
          const { startEditProfile } = await import("./handlers/edit.ts");
          handled = await startEditProfile(ctx);
        } else if (id === "EDIT_PROFILE_NAME") {
          const { promptEditName } = await import("./handlers/edit.ts");
          handled = await promptEditName(ctx);
        } else if (id === "EDIT_PROFILE_LANGUAGE") {
          const { promptEditLanguage } = await import("./handlers/edit.ts");
          handled = await promptEditLanguage(ctx);
        } else if (id.startsWith("LANG::")) {
          const languageCode = id.replace("LANG::", "");
          const { handleEditLanguage } = await import("./handlers/edit.ts");
          handled = await handleEditLanguage(ctx, languageCode);
        } // MoMo QR Code
        else if (id === "MOMO_QR" || id === "momo_qr") {
          const { startMomoQr } = await import(
            "../_shared/wa-webhook-shared/flows/momo/qr.ts"
          );
          handled = await startMomoQr(ctx, state ?? { key: "home" });
        } // MoMo QR Flow buttons
        else if (
          id === IDS.MOMO_QR_MY || id === IDS.MOMO_QR_NUMBER ||
          id === IDS.MOMO_QR_CODE
        ) {
          const { handleMomoButton } = await import(
            "../_shared/wa-webhook-shared/flows/momo/qr.ts"
          );
          handled = await handleMomoButton(
            ctx,
            id,
            state ?? { key: "home", data: {} },
          );
        } // Saved Locations
        else if (
          id === IDS.SAVED_LOCATIONS || id === "SAVED_LOCATIONS" ||
          id === "saved_locations"
        ) {
          const { listSavedLocations } = await import(
            "./handlers/locations.ts"
          );
          handled = await listSavedLocations(ctx);
        } else if (id === IDS.ADD_LOCATION || id === "add_location") {
          const { showAddLocationTypeMenu } = await import(
            "./handlers/locations.ts"
          );
          handled = await showAddLocationTypeMenu(ctx);
        } else if (id.startsWith("LOC::")) {
          const locationId = id.replace("LOC::", "");
          const { handleLocationSelection } = await import(
            "./handlers/locations.ts"
          );
          handled = await handleLocationSelection(ctx, locationId);
        } else if (id.startsWith("ADD_LOC::")) {
          const locationType = id.replace("ADD_LOC::", "");
          const { promptAddLocation } = await import("./handlers/locations.ts");
          handled = await promptAddLocation(ctx, locationType);
        } // Confirm Save Location
        else if (id.startsWith("CONFIRM_SAVE_LOC::")) {
          const locationType = id.replace("CONFIRM_SAVE_LOC::", "");
          const { confirmSaveLocation } = await import(
            "./handlers/locations.ts"
          );
          handled = await confirmSaveLocation(
            ctx,
            locationType,
            state ?? { key: "" },
          );
        } // Use Saved Location
        else if (id.startsWith("USE_LOC::")) {
          const locationId = id.replace("USE_LOC::", "");
          const { handleUseLocation } = await import("./handlers/locations.ts");
          handled = await handleUseLocation(ctx, locationId);
        } // Edit Saved Location
        else if (id.startsWith("EDIT_LOC::")) {
          const locationId = id.replace("EDIT_LOC::", "");
          const { handleEditLocation } = await import(
            "./handlers/locations.ts"
          );
          handled = await handleEditLocation(ctx, locationId);
        } // Delete Saved Location
        else if (id.startsWith("DELETE_LOC::")) {
          const locationId = id.replace("DELETE_LOC::", "");
          const { handleDeleteLocationPrompt } = await import(
            "./handlers/locations.ts"
          );
          handled = await handleDeleteLocationPrompt(ctx, locationId);
        } // Confirm Delete Saved Location
        else if (id.startsWith("CONFIRM_DELETE_LOC::")) {
          const locationId = id.replace("CONFIRM_DELETE_LOC::", "");
          const { confirmDeleteLocation } = await import(
            "./handlers/locations.ts"
          );
          handled = await confirmDeleteLocation(ctx, locationId);
        } // Back to Profile
        else if (id === IDS.BACK_PROFILE) {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        } // Back to Menu (from submenus)
        else if (id === IDS.BACK_MENU || id === "back_menu") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        } // Share EasyMO
        else if (id === IDS.SHARE_EASYMO) {
          if (ctx.profileId) {
            const { ensureReferralLink } = await import(
              "../_shared/wa-webhook-shared/utils/share.ts"
            );
            const { t } = await import(
              "../_shared/wa-webhook-shared/i18n/translator.ts"
            );
            try {
              const link = await ensureReferralLink(
                ctx.supabase,
                ctx.profileId,
              );
              const shareText = [
                t(ctx.locale, "wallet.earn.forward.instructions"),
                t(ctx.locale, "wallet.earn.share_text_intro"),
                link.waLink,
                t(ctx.locale, "wallet.earn.copy.code", { code: link.code }),
                t(ctx.locale, "wallet.earn.note.keep_code"),
              ].join("\n\n");

              await sendButtonsMessage(
                ctx,
                shareText,
                [
                  {
                    id: IDS.WALLET_EARN,
                    title: t(ctx.locale, "wallet.earn.button"),
                  },
                  { id: IDS.BACK_PROFILE, title: "← Back" },
                ],
              );
              handled = true;
            } catch {
              await sendButtonsMessage(
                ctx,
                t(ctx.locale, "wallet.earn.error"),
                [{ id: IDS.BACK_PROFILE, title: "← Back" }],
              );
              handled = true;
            }
          }
        } // MoMo QR
        else if (id === IDS.MOMO_QR || id.startsWith("momoqr_")) {
          const { handleMomoButton, startMomoQr } = await import(
            "../_shared/wa-webhook-shared/flows/momo/qr.ts"
          );
          const momoState = state ?? { key: "momo_qr_menu", data: {} };
          if (id === IDS.MOMO_QR) {
            handled = await startMomoQr(ctx, momoState);
          } else {
            handled = await handleMomoButton(ctx, id, momoState);
          }
        }
      }
    } // Handle Text Messages
    else if (message.type === "text") {
      const textMessage = message as WhatsAppTextMessage;
      const text = textMessage.text?.body?.toLowerCase() ?? "";
      const originalText = textMessage.text?.body?.trim() ?? "";
      const upperText = originalText.toUpperCase();

      // PRIORITY: Check for referral code (REF:CODE or standalone 6-12 char alphanumeric code)
      // This handles new users who click referral links and send the code
      // Patterns match wa-webhook-core/router.ts for consistency
      const refMatch = originalText.match(/^REF[:\s]+([A-Z0-9]{4,12})$/i);
      const isStandaloneCode = /^[A-Z0-9]{6,12}$/.test(upperText) &&
        !/^(HELLO|THANKS|CANCEL|SUBMIT|ACCEPT|REJECT|STATUS|URGENT|PLEASE|PROFILE|WALLET)$/
          .test(upperText);

      if (refMatch || isStandaloneCode) {
        // Referral codes are handled by wa-webhook-wallet
        logEvent(
          "PROFILE_REFERRAL_DEPRECATED",
          { type: "referral_code" },
          "warn",
        );
        await sendText(
          ctx.from,
          "⚠️ Referral feature has been moved. Please restart by sending 'hi' or 'menu'.",
        );
        handled = true;
      } // Check for menu selection key first
      else if (text === "profile") {
        const { startProfile } = await import("./handlers/menu.ts");
        handled = await startProfile(ctx, state ?? { key: "home" });
      } // MOMO QR Text - handle state-based input or keywords
      else if (
        state?.key?.startsWith("momo_qr") || text.includes("momo") ||
        text.includes("qr")
      ) {
        const { handleMomoText, startMomoQr } = await import(
          "../_shared/wa-webhook-shared/flows/momo/qr.ts"
        );
        if (state?.key?.startsWith("momo_qr")) {
          // User is in MoMo flow, handle their text input
          handled = await handleMomoText(
            ctx,
            textMessage.text?.body ?? "",
            state,
          );
        } else {
          // User mentioned "momo" or "qr", start the flow
          handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
      } // Handle profile edit name
      else if (state?.key === IDS.EDIT_PROFILE_NAME) {
        const { handleEditName } = await import("./handlers/edit.ts");
        handled = await handleEditName(ctx, textMessage.text?.body ?? "");
      } // Handle add location (text address)
      else if (state?.key === IDS.ADD_LOCATION && message.type === "text") {
        const address = textMessage.text?.body ?? "";
        const { handleLocationTextAddress } = await import(
          "./handlers/locations.ts"
        );
        handled = await handleLocationTextAddress(ctx, address, state);
      }
    } // ============================================================
    // PHASE 2: Menu Upload Media Handler
    // ============================================================

    // Handle location messages (when user shares location)
    else if (message.type === "location") {
      const locationMessage = message as WhatsAppLocationMessage;
      const location = locationMessage.location;
      const { handleLocationMessage } = await import("./handlers/locations.ts");

      // Try to handle with current state
      if (
        state &&
        (state.key === IDS.ADD_LOCATION || state.key === "edit_location")
      ) {
        handled = await handleLocationMessage(ctx, location, state);
      } else {
        // Fallback: Save location as "recent" if no specific state
        const coords = parseCoordinates(
          location?.latitude,
          location?.longitude,
        );
        if (coords && ctx.profileId) {
          try {
            // Save to location cache for use by other services
            await ctx.supabase.rpc("update_user_location_cache", {
              _user_id: ctx.profileId,
              _lat: coords.lat,
              _lng: coords.lng,
            });
            await sendTextMessage(
              ctx,
              "📍 Location received! You can use this location in other services.",
            );
            handled = true;
            logStructuredEvent("PROFILE_LOCATION_SAVED_FALLBACK", {
              user: ctx.profileId,
              lat: coords.lat,
              lng: coords.lng,
            });
          } catch (error) {
            logStructuredEvent("PROFILE_LOCATION_FALLBACK_ERROR", {
              error: error instanceof Error ? error.message : String(error),
            }, "error");
          }
        }
      }
    }

    // Fallback: Detect phone number pattern (for MoMo QR without keywords)
    if (!handled && message.type === "text") {
      const fallbackTextMessage = message as WhatsAppTextMessage;
      const text = fallbackTextMessage.text?.body?.trim() ?? "";
      // Match phone patterns: +250788123456, 0788123456, 788123456, etc.
      const phonePattern = /^(\+?\d{10,15}|\d{9,10})$/;
      if (phonePattern.test(text.replace(/[\s-]/g, ""))) {
        // Looks like a phone number, treat as MoMo QR input
        const { handleMomoText } = await import(
          "../_shared/wa-webhook-shared/flows/momo/qr.ts"
        );
        handled = await handleMomoText(ctx, text, state ?? { key: "home" });
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

    // Cache successful response
    const successResponse = { success: true, handled };
    if (messageId) {
      responseCache.set(cacheKey, {
        response: successResponse,
        timestamp: Date.now(),
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
