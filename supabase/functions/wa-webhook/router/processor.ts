import type { SupabaseClient } from "../deps.ts";
import type { PreparedWebhook } from "./pipeline.ts";
import { handleMessage } from "./router.ts";
import { buildMessageContext } from "./message_context.ts";
import { claimEvent, releaseEvent } from "../state/idempotency.ts";
import { maybeRunRetention } from "../state/retention.ts";
import { logEvent, logStructuredEvent } from "../observe/log.ts";
import { logMetric } from "../observe/logging.ts";
import { wrapError } from "../utils/middleware.ts";
import { WebhookError } from "../utils/error_handler.ts";
import { routeMessage, forwardToMicroservice } from "../router.ts";
import { getRoutingText } from "../utils/messages.ts";
import { sendButtonsMessage } from "../utils/reply.ts";
import { IDS } from "../wa/ids.ts";
import { t } from "../i18n/translator.ts";

import type {
  RouterContext,
  WhatsAppMessage,
  WhatsAppWebhookPayload,
} from "../types.ts";
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

type RouterMode = "disabled" | "shadow" | "active";
const ROUTER_MODE: RouterMode = parseRouterMode(
  Deno.env.get("WA_ROUTER_MODE") ?? "disabled",
);
const ROUTER_SAMPLE_RATE = clamp01(
  Number(Deno.env.get("WA_ROUTER_SAMPLE_RATE") ?? "0") || 0,
);
const ROUTER_DISABLED_SERVICES = new Set(
  (Deno.env.get("WA_ROUTER_DISABLED_SERVICES") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
);
const ROUTER_TEXT_ONLY = (Deno.env.get("WA_ROUTER_TEXT_ONLY") ?? "true")
  .toLowerCase() !== "false";
// Increase default handler timeout to reduce Meta fallback "snag" in slow paths
const HANDLER_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("WA_HANDLER_TIMEOUT_MS") ?? "10000") || 10000,
  1000,
);

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
  const { payload, messages, contactLocales, requestStart, correlationId } = prepared;
  const withCid = (payload: Record<string, unknown> = {}) => ({
    correlationId,
    ...payload,
  });

  for (const msg of messages) {
    if (!msg?.id) continue;
    const claimed = await hooks.claimEvent(msg.id);
    await hooks.logStructuredEvent(
      claimed ? "IDEMPOTENCY_MISS" : "IDEMPOTENCY_HIT",
      withCid({ message_id: msg.id }),
    );
    if (!claimed) continue;

    const contextResult = await hooks.buildMessageContext(
      supabase,
      msg,
      contactLocales,
    );
    if (!contextResult) continue;

    const { context, state } = contextResult;

    const routingResult = await maybeDispatchToMicroservice(
      payload,
      msg,
      state,
      correlationId,
      withCid,
    );
    if (routingResult?.response) {
      return routingResult.response;
    }
    if (routingResult?.handled) {
      continue;
    }

    const messageStart = Date.now();

    try {
      const timedResult = await runWithTimeout(
        hooks.handleMessage(context, msg, state),
        HANDLER_TIMEOUT_MS,
      );

      if (timedResult.timedOut) {
        await hooks.releaseEvent(msg.id);
        await sendTimeoutFallback(context);
        await hooks.logStructuredEvent("MESSAGE_TIMEOUT_FALLBACK", withCid({
          message_id: msg.id,
          timeout_ms: HANDLER_TIMEOUT_MS,
        }));
        await hooks.logMetric("wa_message_failed", 1, {
          type: msg.type ?? "unknown",
          reason: "timeout",
        });
        continue;
      }

      await hooks.logMetric("wa_message_processed", 1, {
        type: msg.type ?? "unknown",
      });
      await hooks.logStructuredEvent("MESSAGE_LATENCY", withCid({
        message_id: msg.id,
        ms: Date.now() - messageStart,
        type: msg.type ?? null,
      }));
    } catch (err) {
      await hooks.releaseEvent(msg.id);
      await hooks.logStructuredEvent("IDEMPOTENCY_RELEASE", withCid({
        message_id: msg.id,
        reason: err instanceof Error ? err.message : String(err),
      }));
      await hooks.logMetric("wa_message_failed", 1, {
        type: msg.type ?? "unknown",
      });
      if (err instanceof WebhookError) {
        return await wrapError(err, {
          correlationId,
          phoneNumber: msg.from,
          userId: context.profileId,
          operation: "handleMessage",
          duration: Date.now() - messageStart,
        });
      }
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
    correlation_id: correlationId,
  });
  await hooks.logStructuredEvent("WEBHOOK_RESPONSE", withCid({
    status: 200,
    messageCount: messages.length,
  }));
  await hooks.logMetric("wa_webhook_request_ms", Date.now() - requestStart, {
    messageCount: messages.length,
  });

  await hooks.maybeRunRetention();

  return new Response("ok", { status: 200 });
}

type RoutingOutcome = {
  handled: boolean;
  response?: Response;
};

async function maybeDispatchToMicroservice(
  payload: WhatsAppWebhookPayload,
  msg: WhatsAppMessage,
  state: ChatState,
  correlationId: string,
  withCid: (payload?: Record<string, unknown>) => Record<string, unknown>,
): Promise<RoutingOutcome | null> {
  if (ROUTER_MODE === "disabled") return null;
  if (!shouldRouteTraffic()) return null;
  if (ROUTER_TEXT_ONLY && msg.type !== "text") return null;
  const routingText = getRoutingText(msg);
  if (!routingText) return null;
  const chatStateKey = typeof state?.key === "string" ? state.key : undefined;
  const service = await routeMessage(routingText, chatStateKey);
  if (!service || ROUTER_DISABLED_SERVICES.has(service)) {
    return null;
  }
  await hooks.logStructuredEvent("ROUTER_DISPATCH_ATTEMPT", withCid({
    message_id: msg.id,
    service,
    mode: ROUTER_MODE,
  }));

  const forwardHeaders = new Headers({
    "X-Correlation-ID": correlationId,
  });

  if (ROUTER_MODE === "shadow") {
    forwardToMicroservice(service, payload, forwardHeaders)
      .then((response) => {
        console.log(JSON.stringify({
          event: "ROUTER_SHADOW_OK",
          service,
          correlationId,
          status: response.status,
        }));
      })
      .catch((error) => {
        console.error(JSON.stringify({
          event: "ROUTER_SHADOW_ERROR",
          service,
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        }));
      });
    return { handled: false };
  }

  try {
    const response = await forwardToMicroservice(
      service,
      payload,
      forwardHeaders,
    );
    return { handled: true, response };
  } catch (error) {
    console.error(JSON.stringify({
      event: "ROUTER_ACTIVE_ERROR",
      service,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

function shouldRouteTraffic(): boolean {
  if (ROUTER_MODE === "disabled") return false;
  if (ROUTER_MODE === "active") return true;
  if (ROUTER_SAMPLE_RATE <= 0) return false;
  return Math.random() < ROUTER_SAMPLE_RATE;
}

async function sendTimeoutFallback(context: RouterContext): Promise<void> {
  try {
    await sendButtonsMessage(
      context,
      t(context.locale, "error.retry"),
      [{
        id: IDS.BACK_HOME,
        title: t(context.locale, "common.buttons.retry"),
      }],
      { emoji: "⏳" },
    );
  } catch (error) {
    console.error("wa_webhook.timeout_fallback_fail", error);
  }
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ timedOut: boolean; result?: T }> {
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ timedOut: true }), timeoutMs) as
      unknown as number;
  });

  const result = await Promise.race<
    { timedOut: boolean; result?: T }
  >([
    promise.then((value) => ({ timedOut: false, result: value })),
    timeoutPromise,
  ]);

  if (timeoutHandle) clearTimeout(timeoutHandle);
  return result;
}

function parseRouterMode(value: string): RouterMode {
  const normalized = value.toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "shadow") return "shadow";
  return "disabled";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
