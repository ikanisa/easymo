import type { SupabaseClient } from "../deps.ts";
import type { PreparedWebhook } from "./pipeline.ts";
import { handleMessage } from "./router.ts";
import { buildMessageContext } from "./message_context.ts";
import { claimEvent, releaseEvent } from "../state/idempotency.ts";
import { maybeRunRetention } from "../state/retention.ts";
import { logEvent, logStructuredEvent } from "../observe/log.ts";
import { logMetric } from "../observe/logging.ts";

import type { RouterContext, WhatsAppMessage } from "../types.ts";
import type { ChatState } from "../state/store.ts";

export type MessageProcessorHooks = {
  claimEvent: typeof claimEvent;
  releaseEvent: typeof releaseEvent;
  buildMessageContext: typeof buildMessageContext;
  handleMessage: (
    ctx: RouterContext,
    msg: WhatsAppMessage,
    state: ChatState,
  ) => Promise<void>;
  logEvent: typeof logEvent;
  logStructuredEvent: typeof logStructuredEvent;
  logMetric: typeof logMetric;
  maybeRunRetention: typeof maybeRunRetention;
};

const defaultHooks: MessageProcessorHooks = {
  claimEvent,
  releaseEvent,
  buildMessageContext,
  handleMessage,
  logEvent,
  logStructuredEvent,
  logMetric,
  maybeRunRetention,
};

let hooks: MessageProcessorHooks = { ...defaultHooks };

export function __setProcessorTestOverrides(
  overrides: Partial<MessageProcessorHooks>,
): void {
  hooks = { ...hooks, ...overrides };
}

export function __resetProcessorTestOverrides(): void {
  hooks = { ...defaultHooks };
}

export async function handlePreparedWebhook(
  supabase: SupabaseClient,
  prepared: PreparedWebhook,
): Promise<Response> {
  const { payload, messages, contactLocales, requestStart } = prepared;

  for (const msg of messages) {
    if (!msg?.id) continue;
    const claimed = await hooks.claimEvent(msg.id);
    await hooks.logStructuredEvent(claimed ? "IDEMPOTENCY_MISS" : "IDEMPOTENCY_HIT", {
      message_id: msg.id,
    });
    if (!claimed) continue;

    const contextResult = await hooks.buildMessageContext(
      supabase,
      msg,
      contactLocales,
    );
    if (!contextResult) continue;

    const { context, state } = contextResult;
    const messageStart = Date.now();

    try {
      await hooks.handleMessage(context, msg, state);
      await hooks.logMetric("wa_message_processed", 1, {
        type: msg.type ?? "unknown",
      });
      await hooks.logStructuredEvent("MESSAGE_LATENCY", {
        message_id: msg.id,
        ms: Date.now() - messageStart,
        type: msg.type ?? null,
      });
    } catch (err) {
      await hooks.releaseEvent(msg.id);
      await hooks.logStructuredEvent("IDEMPOTENCY_RELEASE", {
        message_id: msg.id,
        reason: err instanceof Error ? err.message : String(err),
      });
      await hooks.logMetric("wa_message_failed", 1, {
        type: msg.type ?? "unknown",
      });
      throw err;
    }
  }

  const entryCount = Array.isArray(payload?.entry) ? payload.entry.length : 0;
  await hooks.logEvent("wa-webhook", {
    status_code: 200,
    entry_count: entryCount,
    message_count: messages.length,
    object: typeof payload?.object === "string" ? payload.object : null,
    processing_ms: Date.now() - requestStart,
  });
  await hooks.logStructuredEvent("WEBHOOK_RESPONSE", {
    status: 200,
    messageCount: messages.length,
  });
  await hooks.logMetric("wa_webhook_request_ms", Date.now() - requestStart, {
    messageCount: messages.length,
  });

  await hooks.maybeRunRetention();

  return new Response("ok", { status: 200 });
}
