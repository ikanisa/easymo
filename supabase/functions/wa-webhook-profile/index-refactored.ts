/**
 * wa-webhook-profile - Profile & Wallet Service
 * Handles user profiles, wallet operations, and business management
 * 
 * @version 2.3.0
 * @description Modular profile service using shared infrastructure
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
import { sendList, sendButtons, sendText } from "../_shared/messaging/index.ts";

// Local handlers - Profile
import {
  startProfile,
} from "./profile/home.ts";

import {
  startEditProfile,
  promptEditName,
  handleEditName,
  promptEditLanguage,
  handleEditLanguage,
} from "./profile/edit.ts";

import {
  listSavedLocations,
  handleLocationSelection,
} from "./profile/locations.ts";

// Local handlers - Wallet
import {
  startWallet,
  handleWalletText,
  resendWalletMenu,
} from "./wallet/home.ts";

import {
  handleCashOut,
  handleCashOutAmount,
  handleCashOutPhone,
  handleCashOutConfirm,
  handleCashOutCancel,
} from "./wallet/cashout.ts";

import {
  showWalletEarn,
  handleWalletEarnSelection,
  handleWalletShareDone,
} from "./wallet/earn.ts";

import {
  handleWalletPurchase,
  handleWalletPurchaseAmount,
  handleWalletPurchaseConfirm,
  handleWalletPurchaseCancel,
} from "./wallet/purchase.ts";

import {
  handleWalletRedeem,
  handleWalletRedeemCode,
  handleWalletRedeemConfirm,
  handleWalletRedeemCancel,
} from "./wallet/redeem.ts";

import {
  handleTransferStart,
  handleTransferRecipient,
  handleTransferAmount,
  handleTransferConfirm,
  handleTransferCancel,
} from "./wallet/transfer.ts";

import {
  handleWalletSecurity,
  handleSecurityPinSetup,
  handleSecurityPinVerify,
} from "./wallet/security.ts";

import {
  handleWalletTransactions,
} from "./wallet/transactions.ts";

import {
  handleWalletNotifications,
} from "./wallet/notifications.ts";

import {
  handleWalletReferral,
} from "./wallet/referral.ts";

// Local handlers - Business
import {
  handleCreateBusinessName,
  listMyBusinesses,
  startCreateBusiness,
  handleBusinessSelection,
  startEditBusiness,
  promptEditField,
  handleUpdateBusinessField,
  confirmDeleteBusiness,
  handleDeleteBusiness,
} from "./business/index.ts";

// Types
import type { RawWhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = SERVICES.PROFILE;
const SERVICE_VERSION = "2.3.0";

validateEnv();

const env = getEnv();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const security = createSecurityMiddleware(SERVICE_NAME, {
  maxBodySize: 2 * 1024 * 1024, // 2MB (for profile photos)
});
const errorHandler = createErrorHandler(SERVICE_NAME);

logStructuredEvent("SERVICE_STARTED", { 
  service: SERVICE_NAME, 
  version: SERVICE_VERSION 
});

// ============================================================================
// PROFILE MENU
// ============================================================================

async function showProfileMenu(ctx: RouterContext): Promise<boolean> {
  return await startProfile(ctx);
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

    // Fallback: Show profile menu
    await showProfileMenu(ctx);
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
  logStructuredEvent("PROFILE_INTERACTION", { id, stateKey: state?.key }, "debug");

  // Main menus
  if (id === "profile" || id === "profile_agent") {
    return await showProfileMenu(ctx);
  }
  if (id === "wallet" || id === "wallet_agent") {
    return await startWallet(ctx);
  }
  if (id === WA_IDS.BACK_MENU || id === WA_IDS.BACK_HOME) {
    return await showProfileMenu(ctx);
  }

  // Profile flows
  if (id === "profile_edit") return await startEditProfile(ctx);
  if (id === "profile_edit_name") return await promptEditName(ctx);
  if (id === "profile_edit_language") return await promptEditLanguage(ctx);
  if (id === "profile_locations") return await listSavedLocations(ctx);
  if (id.startsWith("LOC::") && state?.key === "profile_locations") {
    return await handleLocationSelection(ctx, id);
  }

  // Wallet home
  if (id === "wallet_resend") return await resendWalletMenu(ctx), true;
  if (id === "wallet_transactions") return await handleWalletTransactions(ctx);
  if (id === "wallet_notifications") return await handleWalletNotifications(ctx);
  if (id === "wallet_security") return await handleWalletSecurity(ctx);
  if (id === "wallet_referral") return await handleWalletReferral(ctx);
  if (id === "wallet_earn") return await showWalletEarn(ctx);

  // Wallet earn flow
  if (state?.key === "wallet_earn") {
    return await handleWalletEarnSelection(ctx, id);
  }
  if (id === "wallet_share_done") return await handleWalletShareDone(ctx);

  // Cash out flow
  if (id === "wallet_cashout") return await handleCashOut(ctx);
  if (id === "cashout_cancel" || id === "wallet_cashout_cancel") {
    return await handleCashOutCancel(ctx);
  }
  if (id === "cashout_confirm" && state?.key === "wallet_cashout_confirm") {
    return await handleCashOutConfirm(ctx);
  }

  // Transfer flow
  if (id === "wallet_transfer") return await handleTransferStart(ctx);
  if (id === "transfer_cancel") return await handleTransferCancel(ctx);
  if (id === "transfer_confirm" && state?.key === STATE_KEYS.WALLET_TRANSFER_CONFIRM) {
    return await handleTransferConfirm(ctx, state.data);
  }

  // Purchase flow
  if (id === "wallet_purchase") return await handleWalletPurchase(ctx);
  if (id === "purchase_cancel") return await handleWalletPurchaseCancel(ctx);
  if (id === "purchase_confirm" && state?.key === "wallet_purchase_confirm") {
    return await handleWalletPurchaseConfirm(ctx, state.data);
  }

  // Redeem flow
  if (id === "wallet_redeem") return await handleWalletRedeem(ctx);
  if (id === "redeem_cancel") return await handleWalletRedeemCancel(ctx);
  if (id === "redeem_confirm" && state?.key === "wallet_redeem_confirm") {
    return await handleWalletRedeemConfirm(ctx, state.data);
  }

  // Security flows
  if (state?.key === "wallet_security_pin_setup") {
    return await handleSecurityPinSetup(ctx, state.data);
  }
  if (state?.key === "wallet_security_pin_verify") {
    return await handleSecurityPinVerify(ctx, state.data);
  }

  // Business flows
  if (id === "business_create") return await startCreateBusiness(ctx);
  if (id === "business_list") return await listMyBusinesses(ctx);
  if (id.startsWith("business_update::")) return await startEditBusiness(ctx, id);
  if (id.startsWith("business_delete::")) return await confirmDeleteBusiness(ctx, id);
  if (id.startsWith("BIZ::") && state?.key === "business_selection") {
    return await handleBusinessSelection(ctx, id);
  }

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
  // Profile location save (if we add this feature)
  if (state?.key === "profile_save_location") {
    // TODO: Handle location saving
    return false;
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
  // Profile photo upload (if we add this feature)
  if (state?.key === "profile_photo_upload") {
    // TODO: Handle profile photo upload
    return false;
  }

  // Business document upload
  if (state?.key?.startsWith("business_doc_")) {
    // TODO: Handle business document upload
    return false;
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

  // Profile edit name
  if (state?.key === STATE_KEYS.PROFILE_EDIT_NAME) {
    return await handleEditName(ctx, state.data, text);
  }

  // Profile edit language
  if (state?.key === STATE_KEYS.PROFILE_EDIT_LANGUAGE) {
    return await handleEditLanguage(ctx, state.data, text);
  }

  // Wallet text commands
  if (state?.key === "wallet_home") {
    return await handleWalletText(ctx, text);
  }

  // Cash out amount
  if (state?.key === "wallet_cashout_amount") {
    return await handleCashOutAmount(ctx, state.data, text);
  }
  if (state?.key === "wallet_cashout_phone") {
    return await handleCashOutPhone(ctx, state.data, text);
  }

  // Transfer flows
  if (state?.key === STATE_KEYS.WALLET_TRANSFER_RECIPIENT) {
    return await handleTransferRecipient(ctx, state.data, text);
  }
  if (state?.key === STATE_KEYS.WALLET_TRANSFER_AMOUNT) {
    return await handleTransferAmount(ctx, state.data, text);
  }

  // Purchase amount
  if (state?.key === "wallet_purchase_amount") {
    return await handleWalletPurchaseAmount(ctx, state.data, text);
  }

  // Redeem code
  if (state?.key === "wallet_redeem_code") {
    return await handleWalletRedeemCode(ctx, state.data, text);
  }

  // Business name input
  if (state?.key === "business_create_name") {
    return await handleCreateBusinessName(ctx, state.data, text);
  }
  if (state?.key?.startsWith("business_edit_")) {
    return await handleUpdateBusinessField(ctx, state.data, text);
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
    service: SERVICES.PROFILE,
    timestamp: new Date(),
  };
}
