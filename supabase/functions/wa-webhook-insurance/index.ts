// wa-webhook-insurance - Dedicated Insurance Microservice
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import type { RouterContext, WhatsAppWebhookPayload, RawWhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";

// Insurance domain imports
import { startInsurance, handleInsuranceMedia } from "./insurance/index.ts";
import {
  isInsuranceGated,
  getInsuranceGateMessage,
  handleInsuranceUnlock,
  handleInsuranceHelp,
} from "./insurance/gate.ts";
import { handleInsuranceDocumentUpload } from "./insurance/ins_handler.ts";

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

    // Parse webhook payload
    const payload: WhatsAppWebhookPayload = await req.json();

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

    // Check insurance gate
    const gated = await isInsuranceGated(supabase, ctx.from);
    if (gated) {
      await logEvent("INSURANCE_GATED", { from: ctx.from });
      const gateMessage = await getInsuranceGateMessage(ctx.locale);
      // Send gate message (implementation needed)
      return respond({ success: true, gated: true });
    }

    // Get user state
    const state = ctx.profileId
      ? await getState(supabase, ctx.profileId)
      : { key: "home", data: {} };

    await logEvent("INSURANCE_STATE", { state: state.key });

    // Route based on message type
    let handled = false;

    // Handle interactive buttons
    if (message.type === "interactive" && message.interactive?.type === "button_reply") {
      const buttonId = message.interactive.button_reply?.id;
      handled = await handleInsuranceButton(ctx, buttonId, state);
    }

    // Handle interactive lists
    if (message.type === "interactive" && message.interactive?.type === "list_reply") {
      const listId = message.interactive.list_reply?.id;
      handled = await handleInsuranceList(ctx, listId, state);
    }

    // Handle media (images/documents)
    if (message.type === "image" || message.type === "document") {
      handled = await handleInsuranceMedia(ctx, message);
    }

    // Handle text messages
    if (message.type === "text" && !handled) {
      handled = await handleInsuranceText(ctx, message, state);
    }

    if (!handled) {
      await logEvent("INSURANCE_UNHANDLED", { type: message.type });
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
  payload: WhatsAppWebhookPayload,
): Promise<RouterContext> {
  const from = message.from;
  const messageId = message.id;

  // Get profile ID (simplified - should query database)
  const { data: profile } = await supabase
    .from("whatsapp_users")
    .select("user_id")
    .eq("wa_id", from)
    .single();

  const profileId = profile?.user_id ?? null;

  return {
    from,
    profileId,
    locale: "en", // Default, should detect from profile
    supabase,
  };
}

async function handleInsuranceButton(
  ctx: RouterContext,
  buttonId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  switch (buttonId) {
    case IDS.INSURANCE_START:
      await startInsurance(ctx, state);
      return true;

    case IDS.INSURANCE_HELP:
      await handleInsuranceHelp(ctx);
      return true;

    case IDS.INSURANCE_UNLOCK:
      await handleInsuranceUnlock(ctx);
      return true;

    default:
      return false;
  }
}

async function handleInsuranceList(
  ctx: RouterContext,
  listId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Handle insurance list selections
  if (listId.startsWith("ins_")) {
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
  const text = message.text?.body?.trim().toLowerCase();
  if (!text) return false;

  // Handle insurance-related keywords
  if (["insurance", "assurance", "cover", "claim"].includes(text)) {
    await startInsurance(ctx, state);
    return true;
  }

  // If in insurance state, handle accordingly
  if (state.key?.startsWith("ins_") || state.key === "insurance_upload") {
    await startInsurance(ctx, state);
    return true;
  }

  return false;
}

console.log("wa-webhook-insurance service started");
