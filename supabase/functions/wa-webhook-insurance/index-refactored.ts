/**
 * wa-webhook-insurance - Insurance Service
 * Handles insurance document submission, OCR, claims, and support
 * 
 * @version 2.3.0
 * @description Modular insurance service using shared infrastructure
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared modules
import { getEnv, validateEnv, SERVICES, WA_IDS, STATE_KEYS } from "../_shared/config/index.ts";
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createErrorHandler } from "../_shared/errors/error-handler.ts";
import type { WebhookPayload, RouterContext } from "../_shared/types/index.ts";
import { ensureProfile, getState } from "../_shared/state/index.ts";
import { sendList, insuranceMenuList } from "../_shared/messaging/index.ts";

// Local handlers - Insurance
import {
  startInsurance,
  handleInsuranceListSelection,
  handleInsuranceMedia,
} from "./insurance/index.ts";

import {
  processInsuranceDocument,
  handleInsuranceHelp,
} from "./insurance/ins_handler.ts";

// Local handlers - Claims
import {
  startClaimFlow,
  handleClaimType,
  handleClaimDescription,
  handleClaimDocuments,
  handleClaimSubmit,
  handleClaimStatus,
} from "./insurance/claims.ts";

// Types
import type { RawWhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = SERVICES.INSURANCE;
const SERVICE_VERSION = "2.3.0";

validateEnv();

const env = getEnv();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const security = createSecurityMiddleware(SERVICE_NAME, {
  maxBodySize: 10 * 1024 * 1024, // 10MB (for insurance documents)
});
const errorHandler = createErrorHandler(SERVICE_NAME);

logStructuredEvent("SERVICE_STARTED", { 
  service: SERVICE_NAME, 
  version: SERVICE_VERSION 
});

// ============================================================================
// INSURANCE MENU
// ============================================================================

async function showInsuranceMenu(ctx: RouterContext): Promise<boolean> {
  try {
    const menu = insuranceMenuList(ctx.locale);
    const result = await sendList(ctx, menu);
    return result.success;
  } catch (error) {
    logStructuredEvent("INSURANCE_MENU_ERROR", {
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

    // Fallback: Show insurance menu
    await showInsuranceMenu(ctx);
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

  // Image/document messages (insurance documents)
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
  logStructuredEvent("INSURANCE_INTERACTION", { id, stateKey: state?.key }, "debug");

  // Main menu
  if (id === "insurance" || id === "insurance_agent") {
    return await showInsuranceMenu(ctx);
  }
  if (id === WA_IDS.BACK_MENU || id === WA_IDS.BACK_HOME) {
    return await showInsuranceMenu(ctx);
  }

  // Insurance menu selection
  if (id === WA_IDS.INSURANCE_SUBMIT) {
    return await startInsurance(ctx);
  }
  if (id === WA_IDS.INSURANCE_HELP) {
    return await handleInsuranceHelp(ctx);
  }
  if (id === WA_IDS.INSURANCE_CLAIM) {
    return await startClaimFlow(ctx);
  }

  // Insurance list selection (provider selection)
  if (state?.key === STATE_KEYS.INSURANCE_MENU && id.startsWith("INS::")) {
    return await handleInsuranceListSelection(ctx, state.data, id);
  }

  // Claims flow
  if (id === "claim_start") return await startClaimFlow(ctx);
  if (state?.key === STATE_KEYS.CLAIM_TYPE) {
    return await handleClaimType(ctx, state.data, id);
  }
  if (id === "claim_submit" && state?.key === STATE_KEYS.CLAIM_DOCUMENTS) {
    return await handleClaimSubmit(ctx);
  }
  if (id === "claim_status") return await handleClaimStatus(ctx);
  if (id.startsWith("CLAIM::") && state?.key === "claim_list") {
    // Handle claim detail view
    return false; // TODO: Implement claim detail view
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
  // Insurance document upload
  if (state?.key === STATE_KEYS.INSURANCE_UPLOAD) {
    return await handleInsuranceMedia(ctx, state.data, message);
  }

  // Claim documents upload
  if (state?.key === STATE_KEYS.CLAIM_DOCUMENTS) {
    return await handleClaimDocuments(ctx, state.data, message);
  }

  // Process any insurance-related document
  if (state?.key?.startsWith("ins_")) {
    return await processInsuranceDocument(ctx, message, state.data);
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
  const text = (message.text as any)?.body?.trim() ?? "";

  // Claim description
  if (state?.key === STATE_KEYS.CLAIM_DESCRIPTION) {
    return await handleClaimDescription(ctx, state.data, text);
  }

  // Help/support queries
  if (state?.key === "insurance_help" || text.toLowerCase().includes("help")) {
    return await handleInsuranceHelp(ctx);
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
    service: SERVICES.INSURANCE,
    timestamp: new Date(),
  };
}
