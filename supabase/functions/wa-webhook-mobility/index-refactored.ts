/**
 * wa-webhook-mobility - Mobility Service
 * Handles ride-hailing, scheduling, and driver management
 * 
 * @version 2.3.0
 * @description Modular mobility service using shared infrastructure
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "./deps.ts";

// Shared modules
import { getEnv, validateEnv, SERVICES, WA_IDS, STATE_KEYS } from "../_shared/config/index.ts";
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createErrorHandler } from "../_shared/errors/error-handler.ts";
import type { WebhookPayload, RouterContext } from "../_shared/types/index.ts";
import { ensureProfile, getState } from "../_shared/state/index.ts";
import { sendList, mobilityMenuList } from "../_shared/messaging/index.ts";

// Local handlers
import {
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  handleNearbyLocation,
  handleNearbyResultSelection,
  handleChangeVehicleRequest,
  handleUseCachedLocation,
  startNearbySavedLocationPicker,
  handleNearbySavedLocationSelection,
  isVehicleOption,
} from "./handlers/nearby.ts";

import {
  startScheduleTrip,
  handleScheduleRole,
  handleScheduleVehicle,
  handleScheduleChangeVehicle,
  handleScheduleLocation,
  handleScheduleDropoff,
  handleScheduleSkipDropoff,
  handleScheduleTimeSelection,
  handleScheduleRecurrenceSelection,
  handleScheduleRefresh,
  startScheduleSavedLocationPicker,
  handleScheduleSavedLocationSelection,
} from "./handlers/schedule.ts";

import {
  startGoOnline,
  handleGoOnlineLocation,
  handleGoOnlineUseCached,
  handleGoOffline,
} from "./handlers/go_online.ts";

import {
  routeDriverAction,
} from "./handlers/driver_response.ts";

import {
  handleTripStart,
  handleTripArrivedAtPickup,
  handleTripPickedUp,
  handleTripComplete,
  handleTripCancel,
  handleTripRate,
} from "./handlers/trip_lifecycle.ts";

import {
  handleInsuranceCertificateUpload,
  driverInsuranceStateKey,
  parseInsuranceState,
} from "./handlers/driver_insurance.ts";

import {
  showVerificationMenu,
  startLicenseVerification,
  handleLicenseUpload,
  VERIFICATION_STATES,
} from "./handlers/driver_verification.ts";

import {
  handlePaymentConfirmation,
  processTransactionReference,
  handleSkipPayment,
  PAYMENT_STATES,
} from "./handlers/trip_payment.ts";

import type { RawWhatsAppMessage } from "./types.ts";
import { IDS } from "./wa/ids.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = SERVICES.MOBILITY;
const SERVICE_VERSION = "2.3.0";

validateEnv();

const env = getEnv();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const security = createSecurityMiddleware(SERVICE_NAME);
const errorHandler = createErrorHandler(SERVICE_NAME);

logStructuredEvent("SERVICE_STARTED", { 
  service: SERVICE_NAME, 
  version: SERVICE_VERSION 
});

// ============================================================================
// MAIN MOBILITY MENU
// ============================================================================

async function showMobilityMenu(ctx: RouterContext): Promise<boolean> {
  try {
    const menu = mobilityMenuList(ctx.locale);
    const result = await sendList(ctx, menu);
    return result.success;
  } catch (error) {
    logStructuredEvent("MOBILITY_MENU_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return respond({
      status: "healthy",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    });
  }

  // -------------------------------------------------------------------------
  // Webhook Verification (GET)
  // -------------------------------------------------------------------------
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === env.waVerifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return respond({ error: "verification_failed" }, { status: 403 });
  }

  // -------------------------------------------------------------------------
  // Security Middleware
  // -------------------------------------------------------------------------
  const securityCheck = await security.check(req);
  if (!securityCheck.passed) {
    return securityCheck.response!;
  }

  // -------------------------------------------------------------------------
  // Webhook Processing (POST)
  // -------------------------------------------------------------------------
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const rawBody = await req.text();

    // Signature verification
    const signatureResult = await verifyWebhookRequest(req, rawBody, SERVICE_NAME);
    if (!signatureResult.valid) {
      logStructuredEvent("AUTH_FAILED", { 
        requestId, 
        reason: signatureResult.reason 
      }, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return respond({ error: "invalid_payload" }, { status: 400 });
    }

    // Extract message
    const message = extractFirstMessage(payload);
    if (!message) {
      return respond({ success: true, ignored: "no_message" });
    }

    // Build context
    const ctx = await buildContext(message, requestId, correlationId);

    // Get user state
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;

    // Route message
    const handled = await routeMessage(ctx, message, state);

    if (handled) {
      return respond({ success: true, handled: true });
    }

    // Fallback: Show mobility menu
    await showMobilityMenu(ctx);
    return respond({ success: true, handled: true, fallback: true });

  } catch (error) {
    return await errorHandler.handleError(error, {
      requestId,
      correlationId,
      operation: "webhook_processing",
    });
  }
});

// ============================================================================
// MESSAGE ROUTING
// ============================================================================

async function routeMessage(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: any
): Promise<boolean> {
  const messageType = message.type ?? "unknown";

  // Interactive messages (buttons/lists)
  if (messageType === "interactive") {
    const interactive = message.interactive as any;
    const buttonId = interactive?.button_reply?.id;
    const listId = interactive?.list_reply?.id;
    const id = buttonId || listId;

    if (id) {
      return await handleInteractiveMessage(ctx, id, state);
    }
  }

  // Location messages
  if (messageType === "location") {
    return await handleLocationMessage(ctx, message, state);
  }

  // Image/document messages
  if (messageType === "image" || messageType === "document") {
    return await handleMediaMessage(ctx, message, state);
  }

  // Text messages
  if (messageType === "text") {
    return await handleTextMessage(ctx, message, state);
  }

  return false;
}

// ============================================================================
// INTERACTIVE MESSAGE HANDLER
// ============================================================================

async function handleInteractiveMessage(
  ctx: RouterContext,
  id: string,
  state: any
): Promise<boolean> {
  logStructuredEvent("MOBILITY_INTERACTION", { id, stateKey: state?.key }, "debug");

  // Main menu
  if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
    return await showMobilityMenu(ctx);
  }
  if (id === WA_IDS.BACK_MENU || id === WA_IDS.BACK_HOME) {
    return await showMobilityMenu(ctx);
  }

  // Nearby flows
  if (id === IDS.SEE_DRIVERS) return await handleSeeDrivers(ctx);
  if (id === IDS.SEE_PASSENGERS) return await handleSeePassengers(ctx);
  if (isVehicleOption(id) && state?.key === STATE_KEYS.MOBILITY_NEARBY_SELECT) {
    return await handleVehicleSelection(ctx, state.data, id);
  }
  if (id.startsWith("MTCH::") && state?.key === STATE_KEYS.MOBILITY_NEARBY_RESULTS) {
    return await handleNearbyResultSelection(ctx, state.data, id);
  }
  if (id === IDS.MOBILITY_CHANGE_VEHICLE) {
    return await handleChangeVehicleRequest(ctx, state?.data);
  }
  if (id === IDS.USE_CACHED_LOCATION && state?.key === STATE_KEYS.MOBILITY_NEARBY_LOCATION) {
    return await handleUseCachedLocation(ctx, state.data);
  }
  if (id === IDS.LOCATION_SAVED_LIST && state?.key === STATE_KEYS.MOBILITY_NEARBY_LOCATION) {
    return await startNearbySavedLocationPicker(ctx, state.data);
  }
  if (id.startsWith("FAV::") && state?.key === "location_saved_picker" && state.data?.source === "nearby") {
    return await handleNearbySavedLocationSelection(ctx, state.data, id);
  }

  // Schedule flows
  if (id === IDS.SCHEDULE_TRIP) return await startScheduleTrip(ctx);
  if (state?.key === STATE_KEYS.SCHEDULE_ROLE) return await handleScheduleRole(ctx, id);
  if (isVehicleOption(id) && state?.key === STATE_KEYS.SCHEDULE_VEHICLE) {
    return await handleScheduleVehicle(ctx, state.data, id);
  }
  if (id === IDS.MOBILITY_CHANGE_VEHICLE && state?.key === STATE_KEYS.SCHEDULE_VEHICLE) {
    return await handleScheduleChangeVehicle(ctx, state.data);
  }
  if (id === "schedule_skip_dropoff") return await handleScheduleSkipDropoff(ctx, state?.data);
  if (id.startsWith("TIME::") && state?.key === STATE_KEYS.SCHEDULE_TIME) {
    return await handleScheduleTimeSelection(ctx, state.data, id);
  }
  if (id.startsWith("RECUR::") && state?.key === "schedule_recurrence") {
    return await handleScheduleRecurrenceSelection(ctx, state.data, id);
  }
  if (id === "schedule_refresh") return await handleScheduleRefresh(ctx, state?.data);
  if (id === IDS.LOCATION_SAVED_LIST && state?.key === STATE_KEYS.SCHEDULE_LOCATION) {
    return await startScheduleSavedLocationPicker(ctx, state.data);
  }
  if (id.startsWith("FAV::") && state?.key === "location_saved_picker" && state.data?.source === "schedule") {
    return await handleScheduleSavedLocationSelection(ctx, state.data, id);
  }

  // Go online/offline
  if (id === IDS.GO_ONLINE || id === "driver_go_online") {
    return await startGoOnline(ctx);
  }
  if (id === IDS.USE_CACHED_LOCATION && state?.key === STATE_KEYS.GO_ONLINE_PROMPT) {
    return await handleGoOnlineUseCached(ctx);
  }
  if (id === IDS.DRIVER_GO_OFFLINE) return await handleGoOffline(ctx);

  // Driver actions
  if (id.startsWith(IDS.DRIVER_OFFER_RIDE + "::") || id.startsWith(IDS.DRIVER_VIEW_DETAILS + "::")) {
    return await routeDriverAction(ctx, id);
  }

  // Trip lifecycle
  if (id.startsWith("TRIP_START::")) return await handleTripStart(ctx, id);
  if (id.startsWith("TRIP_ARRIVED::")) return await handleTripArrivedAtPickup(ctx, id);
  if (id.startsWith("TRIP_PICKED_UP::")) return await handleTripPickedUp(ctx, id);
  if (id.startsWith("TRIP_COMPLETE::")) return await handleTripComplete(ctx, id);
  if (id.startsWith("TRIP_CANCEL::")) return await handleTripCancel(ctx, id);
  if (id.startsWith("RATE::")) return await handleTripRate(ctx, id);

  // Payment
  if (id === "payment_paid" && PAYMENT_STATES.includes(state?.key)) {
    return await handlePaymentConfirmation(ctx, state?.data);
  }
  if (id === "payment_skip" && PAYMENT_STATES.includes(state?.key)) {
    return await handleSkipPayment(ctx, state?.data);
  }

  // Verification
  if (id === "verify_license") return await startLicenseVerification(ctx);

  return false;
}

// ============================================================================
// LOCATION MESSAGE HANDLER
// ============================================================================

async function handleLocationMessage(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: any
): Promise<boolean> {
  if (state?.key === STATE_KEYS.MOBILITY_NEARBY_LOCATION) {
    return await handleNearbyLocation(ctx, state.data, message);
  }
  if (state?.key === STATE_KEYS.SCHEDULE_LOCATION) {
    return await handleScheduleLocation(ctx, state.data, message);
  }
  if (state?.key === STATE_KEYS.SCHEDULE_DROPOFF) {
    return await handleScheduleDropoff(ctx, state.data, message);
  }
  if (state?.key === STATE_KEYS.GO_ONLINE_PROMPT) {
    return await handleGoOnlineLocation(ctx, message);
  }
  return false;
}

// ============================================================================
// MEDIA MESSAGE HANDLER
// ============================================================================

async function handleMediaMessage(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: any
): Promise<boolean> {
  // Driver insurance upload
  if (state?.key === driverInsuranceStateKey) {
    const insuranceState = parseInsuranceState(state.data);
    return await handleInsuranceCertificateUpload(ctx, insuranceState, message);
  }

  // License verification upload
  if (VERIFICATION_STATES.includes(state?.key)) {
    return await handleLicenseUpload(ctx, state, message);
  }

  return false;
}

// ============================================================================
// TEXT MESSAGE HANDLER
// ============================================================================

async function handleTextMessage(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: any
): Promise<boolean> {
  const text = (message.text as any)?.body?.toLowerCase().trim() ?? "";

  // Payment transaction reference
  if (PAYMENT_STATES.includes(state?.key)) {
    return await processTransactionReference(ctx, state?.data, text);
  }

  return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractFirstMessage(payload: WebhookPayload): RawWhatsAppMessage | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (messages?.length) {
        return messages[0] as RawWhatsAppMessage;
      }
    }
  }
  return null;
}

async function buildContext(
  message: RawWhatsAppMessage,
  requestId: string,
  correlationId: string
): Promise<RouterContext> {
  const from = String(message.from ?? "");
  const profile = await ensureProfile(supabase, from);

  return {
    supabase,
    from,
    profileId: profile?.user_id,
    locale: (profile?.language || "en") as any,
    requestId,
    correlationId,
    service: SERVICES.MOBILITY,
    timestamp: new Date(),
  };
}
