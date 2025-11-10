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

export async function startNearbyQuincailleries(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_location",
    data: {},
  });
  
  await sendButtonsMessage(
    ctx,
    "🔧 *Nearby Quincailleries*\n\n" +
    "Share your location to find hardware stores near you.\n\n" +
    "📍 Tap the button below to share your location, or use the attachment icon.",
    buildButtons(
      { id: "quincaillerie_share_location", title: "📍 Share Location" },
      { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
    )
  );
  
  return true;
}

export async function handleQuincaillerieLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Ask for optional item information
  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_items",
    data: { location },
  });
  
  await sendButtonsMessage(
    ctx,
    "📍 *Location received!*\n\n" +
    "🔧 What would you like to do?",
    buildButtons(
      { id: "quincaillerie_search_all", title: "🔍 Search All Stores" },
      { id: "quincaillerie_add_items", title: "🔧 Specify Items" },
      { id: IDS.BACK_HOME, title: "🏠 Cancel" }
    )
  );
  
  return true;
}
