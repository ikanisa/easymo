/**
 * Nearby Quincailleries (Hardware Stores) Flow
 * 
 * User flow:
 * 1. Select "Nearby Quincailleries" from home menu
 * 2. Share location
 * 3. (Optional) Share item image or type item names
 * 4. AI Agent takes over: searches DB, chats with stores, negotiates prices
 * 5. Returns 3 curated options (5-min timeout)
 */

import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAINearbyQuincailleries } from "../ai-agents/index.ts";
import { IDS } from "../../wa/ids.ts";
import { t } from "../../i18n/translator.ts";

export async function startNearbyQuincailleries(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_location",
    data: {},
  });
  
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "quincaillerie.start.prompt"),
    buildButtons(
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    )
  );
  
  return true;
}

export async function handleQuincaillerieLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Prompt for item name or image
  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_items",
    data: { location },
  });
  
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "quincaillerie.location.received"),
    buildButtons(
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    )
  );
  
  return true;
}
