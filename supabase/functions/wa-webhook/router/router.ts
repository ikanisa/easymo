import type {
  RouterContext,
  WhatsAppInteractiveButtonMessage,
  WhatsAppInteractiveListMessage,
  WhatsAppLocationMessage,
  WhatsAppMediaMessage,
  WhatsAppMessage,
  WhatsAppTextMessage,
} from "../types.ts";
import type { ChatState } from "../state/store.ts";
import { handleMedia } from "./media.ts";
import { handleList } from "./interactive_list.ts";
import { handleButton } from "./interactive_button.ts";
import { handleLocation } from "./location.ts";
import { handleText } from "./text.ts";
import { runGuards } from "./guards.ts";
import { logError } from "../observe/log.ts";
import { logUnhandled } from "../observe/logging.ts";
import {
  isInteractiveButtonMessage,
  isInteractiveListMessage,
  isLocationMessage,
  isMediaMessage,
  isTextMessage,
} from "../utils/messages.ts";
import { getCached, setCached } from "../utils/cache.ts";
import { webhookConfig } from "../config.ts";
import { incrementMetric } from "../utils/metrics_collector.ts";

type RouterHooks = {
  runGuards: (
    ctx: RouterContext,
    msg: WhatsAppMessage,
    state: ChatState,
  ) => Promise<boolean>;
  handleMedia: (
    ctx: RouterContext,
    msg: WhatsAppMediaMessage,
    state: ChatState,
  ) => Promise<boolean>;
  handleList: (
    ctx: RouterContext,
    msg: WhatsAppInteractiveListMessage,
    state: ChatState,
  ) => Promise<boolean>;
  handleButton: (
    ctx: RouterContext,
    msg: WhatsAppInteractiveButtonMessage,
    state: ChatState,
  ) => Promise<boolean>;
  handleLocation: (
    ctx: RouterContext,
    msg: WhatsAppLocationMessage,
    state: ChatState,
  ) => Promise<boolean>;
  handleText: (
    ctx: RouterContext,
    msg: WhatsAppTextMessage,
    state: ChatState,
  ) => Promise<boolean>;
  logUnhandled: typeof logUnhandled;
};

const defaultHooks: RouterHooks = {
  runGuards,
  handleMedia,
  handleList,
  handleButton,
  handleLocation,
  handleText,
  logUnhandled,
};

let hooks: RouterHooks = { ...defaultHooks };

type RouterEnhancementHooks = {
type RouterCacheHooks = {
  getCached: typeof getCached;
  setCached: typeof setCached;
};

const enhancementDefaults: RouterEnhancementHooks = {
const cacheDefaults: RouterCacheHooks = {
  getCached,
  setCached,
};

let cacheHooks: RouterCacheHooks = { ...cacheDefaults };

export function __setRouterTestOverrides(
  overrides: Partial<RouterHooks>,
): void {
  hooks = { ...hooks, ...overrides };
}

export function __resetRouterTestOverrides(): void {
  hooks = { ...defaultHooks };
}

export function __setRouterEnhancementOverrides(
  overrides: Partial<RouterCacheHooks>,
): void {
  cacheHooks = { ...cacheHooks, ...overrides };
}

export function __resetRouterEnhancementOverrides(): void {
  cacheHooks = { ...cacheDefaults };
}

export async function handleMessage(
  ctx: RouterContext,
  msg: WhatsAppMessage,
  state: ChatState,
): Promise<void> {
  const LOG_LEVEL = (Deno.env.get("LOG_LEVEL") ?? "").toLowerCase();
  const correlationCacheKey = `wa:webhook:cid:msg:${msg.id}`;
  const cachedCorrelation = webhookConfig.cache.enabled
    ? cacheHooks.getCached<string>(correlationCacheKey)
    : null;
  const correlationId = cachedCorrelation ?? crypto.randomUUID();
  if (webhookConfig.cache.enabled && !cachedCorrelation) {
    cacheHooks.setCached(
      correlationCacheKey,
      correlationId,
      webhookConfig.cache.defaultTTL,
    );
  }
  const withCid = (payload: Record<string, unknown> = {}) => ({
    correlationId,
    messageId: msg.id,
    ...payload,
  });

  const dbg = (route: string) => {
    if (LOG_LEVEL === "debug") {
      console.debug("router.route_decision", {
        route,
        id: msg.id,
        type: msg.type,
        correlationId,
      });
    }
  };
  if (LOG_LEVEL === "debug") {
    console.debug("router.entry", {
      id: msg.id,
      from: (msg as any)?.from,
      type: msg.type,
      correlationId,
    });
  }

  incrementMetric("wa_webhook_message_received_total", 1, {
    type: msg.type ?? "unknown",
  });
  console.log(JSON.stringify({
    event: "ROUTER_MESSAGE_RECEIVED",
    correlationId,
    messageId: msg.id,
    from: (msg as any)?.from ?? null,
    type: msg.type,
  }));

  type RouteDecision = { route: string; timestamp: number };
  const routeCacheKey = `wa:webhook:route:${msg.id}`;
  const cachedDecision = webhookConfig.cache.enabled
    ? cacheHooks.getCached<RouteDecision>(routeCacheKey)
    : null;
  if (cachedDecision) {
    incrementMetric("wa_webhook_message_cache_hit_total", 1, {
      route: cachedDecision.route,
    });
    console.log(JSON.stringify({
      event: "ROUTER_ROUTE_CACHE_HIT",
      correlationId,
      messageId: msg.id,
      route: cachedDecision.route,
    }));
    return;
  }

  const rememberRoute = (route: string) => {
    if (webhookConfig.cache.enabled) {
      cacheHooks.setCached(
        routeCacheKey,
        { route, timestamp: Date.now() },
        webhookConfig.cache.defaultTTL,
      );
    }
    incrementMetric("wa_webhook_message_success_total", 1, {
      route,
      type: msg.type ?? "unknown",
    });
    console.log(JSON.stringify({
      event: "ROUTER_ROUTE_SELECTED",
      correlationId,
      messageId: msg.id,
      route,
    }));
  };

  try {
    if (await hooks.runGuards(ctx, msg, state)) {
      rememberRoute("guarded");
      dbg("guarded");
      return;
    }
    if (isMediaMessage(msg) && await hooks.handleMedia(ctx, msg, state)) {
      rememberRoute("media");
      dbg("media");
      return;
    }
    if (
      isInteractiveListMessage(msg) && await hooks.handleList(ctx, msg, state)
    ) {
      rememberRoute("interactive_list");
      dbg("interactive_list");
      return;
    }
    if (
      isInteractiveButtonMessage(msg) &&
      await hooks.handleButton(ctx, msg, state)
    ) {
      rememberRoute("interactive_button");
      dbg("interactive_button");
      return;
    }
    if (isLocationMessage(msg) && await hooks.handleLocation(ctx, msg, state)) {
      rememberRoute("location");
      dbg("location");
      return;
    }
    if (isTextMessage(msg) && await hooks.handleText(ctx, msg, state)) {
      rememberRoute("text");
      dbg("text");
      return;
    }
    await hooks.logUnhandled(msg.type);
    rememberRoute("unhandled");
  } catch (err) {
    incrementMetric("wa_webhook_message_failed_total", 1, {
      type: msg.type ?? "unknown",
    });
    logError("wa_router.handleMessage", err, withCid({ msg }));
    throw err;
  }
}
