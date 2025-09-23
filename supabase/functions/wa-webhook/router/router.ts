import type { RouterContext } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import { handleMedia } from "./media.ts";
import { handleList } from "./interactive_list.ts";
import { handleButton } from "./interactive_button.ts";
import { handleLocation } from "./location.ts";
import { handleText } from "./text.ts";
import { runGuards } from "./guards.ts";
import { logError } from "../observe/log.ts";

export async function handleMessage(ctx: RouterContext, msg: any, state: ChatState): Promise<void> {
  try {
    if (await runGuards(ctx, msg)) return;
    if (await handleMedia(ctx, msg, state)) return;
    if (msg.type === "interactive" && msg.interactive?.type === "list_reply") {
      if (await handleList(ctx, msg, state)) return;
    }
    if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
      if (await handleButton(ctx, msg, state)) return;
    }
    if (msg.type === "location") {
      if (await handleLocation(ctx, msg, state)) return;
    }
    if (msg.type === "text") {
      if (await handleText(ctx, msg, state)) return;
    }
    console.log("wa_router.unhandled", { type: msg.type });
  } catch (err) {
    logError("wa_router.handleMessage", err, { msg });
  }
}
