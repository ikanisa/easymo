// wa-webhook-insurance - Dedicated Insurance Microservice
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import type { RouterContext, WhatsAppWebhookPayload, RawWhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";


// Insurance domain imports
import { startInsurance, handleInsuranceMedia, handleInsuranceListSelection } from "./insurance/index.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
  sendMotorInsuranceBlockedMessage,
} from "../_shared/wa-webhook-shared/domains/insurance/gate.ts";
import {
  startClaimFlow,
  handleClaimType,
  handleClaimDescription,
  handleClaimDocuments,
  handleClaimSubmit,
  handleClaimStatus,
  CLAIM_STATES
} from "./insurance/claims.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-insurance");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = async (
    event: string,
    payload?: Record<string, unknown>,
  ) => {
    await logStructuredEvent(event, {
      service: "wa-webhook-insurance",
      requestId,
      correlationId,
      ...payload,
    });
  };

  try {
    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      return respond({
        status: "healthy",
        service: "wa-webhook-insurance",
        timestamp: new Date().toISOString(),
      });
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed" }, { status: 405 });
    }

    const rawBody = await req.text();

    // Signature verification
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const signatureMeta = (() => {
      if (!signature) {
        return {
          provided: false,
          header: signatureHeader,
          method: null as string | null,
          sample: null as string | null,
        };
      }
      const [method, hash] = signature.split("=", 2);
      return {
        provided: true,
        header: signatureHeader,
        method: method?.toLowerCase() ?? null,
        sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
      };
    })();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      await logEvent("INSURANCE_AUTH_CONFIG_ERROR", { reason: "missing_app_secret" });
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
        if (isValidSignature) {
          await logEvent("INSURANCE_SIGNATURE_VALID", {
            signatureHeader,
            signatureMethod: signatureMeta.method,
          });
        }
      } catch (err) {
        await logEvent("INSURANCE_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        await logEvent("INSURANCE_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        });
      } else {
        await logEvent("INSURANCE_AUTH_FAILED", {
          signatureProvided: signatureMeta.provided,
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        });
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {} as WhatsAppWebhookPayload;
    } catch (parseError) {
      await logEvent("INSURANCE_PAYLOAD_INVALID_JSON", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return respond({ error: "invalid_payload" }, { status: 400 });
    }

    await logEvent("INSURANCE_WEBHOOK_RECEIVED", {
      entry_count: payload.entry?.length ?? 0,
    });

    // Extract first message
    const message = getFirstMessage(payload);
    if (!message) {
      await logEvent("INSURANCE_NO_MESSAGE");
      return respond({ success: true, message: "No message to process" });
    }

    // Build context
    const ctx: RouterContext = await buildContext(message, payload);

    // Get user state
    const state = ctx.profileId
      ? await getState(supabase, ctx.profileId)
      : { key: "home", data: {} };

    await logEvent("INSURANCE_STATE", { state: state.key });

    // Route based on message type
    let handled = false;

    try {
      // Handle interactive buttons
      if (message.type === "interactive" && (message as WhatsAppInteractiveMessage).interactive?.type === "button_reply") {
        const interactiveMessage = message as WhatsAppInteractiveMessage;
        const buttonId = interactiveMessage.interactive?.button_reply?.id;
        handled = await handleInsuranceButton(ctx, buttonId, state);
      }

      // Handle interactive lists
      if (message.type === "interactive" && (message as WhatsAppInteractiveMessage).interactive?.type === "list_reply") {
        const interactiveMessage = message as WhatsAppInteractiveMessage;
        const listId = interactiveMessage.interactive?.list_reply?.id;
        handled = await handleInsuranceList(ctx, listId, state);
      }

      // Handle media (images/documents)
      if (message.type === "image" || message.type === "document") {
        handled = await handleInsuranceMedia(ctx, message, state);
      }

      // Handle text messages
      if (message.type === "text" && !handled) {
        handled = await handleInsuranceText(ctx, message, state);
      }

      if (!handled) {
        await logEvent("INSURANCE_UNHANDLED", { type: message.type });
      }
    } catch (handlerError) {
      await logEvent("INSURANCE_HANDLER_ERROR", { 
        error: handlerError instanceof Error ? handlerError.message : String(handlerError),
        messageType: message.type,
      });
      // Send error message to user
      const { sendText } = await import("../_shared/wa-webhook-shared/wa/client.ts");
      try {
        await sendText(ctx.from, "Sorry, something went wrong. Please try again.");
      } catch (_sendError) {
        // Ignore send errors - already logged main error
      }
      return respond({ success: false, error: "handler_error" });
    }

    return respond({ success: true, handled });

  } catch (error) {
    await logEvent("INSURANCE_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return respond(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
});

// Helper functions
function getFirstMessage(payload: WhatsAppWebhookPayload): RawWhatsAppMessage | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (messages && messages.length > 0) {
        return messages[0];
      }
    }
  }
  return null;
}

async function buildContext(
  message: RawWhatsAppMessage,
  _payload: WhatsAppWebhookPayload,
): Promise<RouterContext> {
  if (!message.from) { // Add null check
    throw new Error("Message 'from' field is missing.");
  }
  const from = message.from;

  // Auto-create profile if needed
  const { ensureProfile } = await import("../_shared/wa-webhook-shared/utils/profile.ts");
  const profile = await ensureProfile(supabase, from);

  return {
    from,
    profileId: profile?.user_id ?? undefined,
    locale: (profile?.language || "en") as SupportedLanguage,
    supabase,
  };
}

async function handleInsuranceButton(
  ctx: RouterContext,
  buttonId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Handle insurance button selections
  if (buttonId.startsWith("ins_") || buttonId === "insurance_agent" || buttonId === "insurance" || buttonId === "insurance_submit" || buttonId === "insurance_help" || buttonId === "motor_insurance_upload") {
    // If it's a specific action like submit or help, delegate to list selection handler
    if (buttonId === "insurance_submit" || buttonId === "insurance_help" || buttonId === "motor_insurance_upload") {
      return await handleInsuranceListSelection(ctx, state, buttonId);
    }
    await startInsurance(ctx, state);
    return true;
  }
  
  return false;
}

async function handleInsuranceList(
  ctx: RouterContext,
  listId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Handle insurance list selections
  if (listId.startsWith("ins_") || listId === "insurance_agent" || listId === "insurance" || listId === "insurance_submit" || listId === "insurance_help" || listId === "motor_insurance_upload") {
    // If it's a specific action like submit or help, handle the selection
    if (listId === "insurance_submit" || listId === "insurance_help" || listId === "motor_insurance_upload") {
      return await handleInsuranceListSelection(ctx, state, listId);
    }
    // Otherwise show the menu
    await startInsurance(ctx, state);
    return true;
  }

  return false;
}

async function handleInsuranceText(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const text = (message as WhatsAppTextMessage).text?.body?.trim().toLowerCase();
  if (!text) return false;

  // Handle claims-related keywords
  if (text === "claim" || text === "file claim" || text.startsWith("claim ")) {
    if (text.startsWith("claim status")) {
      const claimRef = text.replace("claim status", "").trim();
      return await handleClaimStatus(ctx, claimRef || undefined);
    }
    return await startClaimFlow(ctx);
  }

  // Handle "done" for document upload completion
  if (text === "done" && state.key === CLAIM_STATES.DOCUMENTS) {
    return await handleClaimSubmit(ctx);
  }

  // Handle claim description input
  if (state.key === CLAIM_STATES.DESCRIPTION) {
    return await handleClaimDescription(ctx, text);
  }

  // Check for menu selection keys first
  if (text === "insurance_agent" || text === "insurance") {
    await startInsurance(ctx, state);
    return true;
  }

  // Handle insurance-related keywords
  if (["assurance", "cover"].includes(text)) {
    await startInsurance(ctx, state);
    return true;
  }

  // If in insurance state, handle accordingly
  if (state.key?.startsWith("ins_") || state.key === "insurance_upload") {
    await startInsurance(ctx, state);
    return true;
  }

  // Fallback: Show home menu for any unhandled text
  // This provides better UX - any free text returns user to home menu
  const { sendHomeMenu } = await import("../_shared/wa-webhook-shared/flows/home.ts");
  await sendHomeMenu(ctx);
  return true;
}

console.log("wa-webhook-insurance service started");
