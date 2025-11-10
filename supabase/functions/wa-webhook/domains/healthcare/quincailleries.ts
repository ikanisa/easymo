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
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAINearbyQuincailleries } from "../ai-agents/index.ts";

export async function startNearbyQuincailleries(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_location",
    data: {},
  });
  
  await sendText(
    ctx.from,
    "🔧 *Nearby Quincailleries*\n\n" +
    "Share your location to find hardware stores near you.\n\n" +
    "📍 Tap the attachment icon → Location → Send your location"
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
  
  await sendText(
    ctx.from,
    "📍 Location received!\n\n" +
    "🔧 *Optional:* You can now:\n" +
    "• Share a photo of the items you need\n" +
    "• Type the item names you're looking for\n" +
    "• Or just send \"search\" to search all hardware stores nearby"
  );
  
  return true;
}
