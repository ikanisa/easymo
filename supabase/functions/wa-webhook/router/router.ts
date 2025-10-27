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

export function __setRouterTestOverrides(
  overrides: Partial<RouterHooks>,
): void {
  hooks = { ...hooks, ...overrides };
}

export function __resetRouterTestOverrides(): void {
  hooks = { ...defaultHooks };
}

export async function handleMessage(
  ctx: RouterContext,
  msg: WhatsAppMessage,
  state: ChatState,
): Promise<void> {
  const LOG_LEVEL = (Deno.env.get("LOG_LEVEL") ?? "").toLowerCase();
  const dbg = (route: string) => {
    if (LOG_LEVEL === "debug") {
      console.debug("router.route_decision", {
        route,
        id: msg.id,
        type: msg.type,
      });
    }
  };
  if (LOG_LEVEL === "debug") {
    console.debug("router.entry", {
      id: msg.id,
      from: (msg as any)?.from,
      type: msg.type,
    });
  }
  try {
    if (await hooks.runGuards(ctx, msg, state)) return;
    if (isMediaMessage(msg) && await hooks.handleMedia(ctx, msg, state)) {
      dbg("media");
      return;
    }
    if (
      isInteractiveListMessage(msg) && await hooks.handleList(ctx, msg, state)
    ) {
      dbg("interactive_list");
      return;
    }
    if (
      isInteractiveButtonMessage(msg) &&
      await hooks.handleButton(ctx, msg, state)
    ) {
      dbg("interactive_button");
      return;
    }
    if (isLocationMessage(msg) && await hooks.handleLocation(ctx, msg, state)) {
      dbg("location");
      return;
    }
    if (isTextMessage(msg) && await hooks.handleText(ctx, msg, state)) {
      dbg("text");
      return;
    }
    await hooks.logUnhandled(msg.type);
  } catch (err) {
    logError("wa_router.handleMessage", err, { msg });
    throw err;
  }
}
