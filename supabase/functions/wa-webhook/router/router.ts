import type { RouterContext } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import { handleMedia } from "./media.ts";
import { handleList } from "./interactive_list.ts";
import { handleButton } from "./interactive_button.ts";
import { handleLocation } from "./location.ts";
import { handleText } from "./text.ts";
import { runGuards } from "./guards.ts";
import { logError } from "../observe/log.ts";
import { logUnhandled } from "../observe/logging.ts";

type RouterHooks = {
  runGuards: typeof runGuards;
  handleMedia: typeof handleMedia;
  handleList: typeof handleList;
  handleButton: typeof handleButton;
  handleLocation: typeof handleLocation;
  handleText: typeof handleText;
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
  msg: any,
  state: ChatState,
): Promise<void> {
  try {
    if (await hooks.runGuards(ctx, msg, state)) return;
    if (await hooks.handleMedia(ctx, msg, state)) return;
    if (msg.type === "interactive" && msg.interactive?.type === "list_reply") {
      if (await hooks.handleList(ctx, msg, state)) return;
    }
    if (
      msg.type === "interactive" && msg.interactive?.type === "button_reply"
    ) {
      if (await hooks.handleButton(ctx, msg, state)) return;
    }
    if (msg.type === "location") {
      if (await hooks.handleLocation(ctx, msg, state)) return;
    }
    if (msg.type === "text") {
      if (await hooks.handleText(ctx, msg, state)) return;
    }
    await hooks.logUnhandled(msg.type);
  } catch (err) {
    logError("wa_router.handleMessage", err, { msg });
  }
}
