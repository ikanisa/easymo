/**
 * Nearby Pharmacies Flow
 * 
 * User flow:
 * 1. Select "Nearby Pharmacies" from home menu
 * 2. Share location
 * 3. (Optional) Share medicine image/name or type medicine name
 * 4. AI Agent takes over: searches DB, chats with pharmacies, negotiates prices
 * 5. Returns 3 curated options (5-min timeout)
 */

import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAINearbyPharmacies } from "../ai-agents/index.ts";

export async function startNearbyPharmacies(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "pharmacy_awaiting_location",
    data: {},
  });
  
  await sendText(
    ctx.from,
    "💊 *Nearby Pharmacies*\n\n" +
    "Share your location to find pharmacies near you.\n\n" +
    "📍 Tap the attachment icon → Location → Send your location"
  );
  
  return true;
}

export async function handlePharmacyLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Ask for optional medicine information
  await setState(ctx.supabase, ctx.profileId, {
    key: "pharmacy_awaiting_medicine",
    data: { location },
  });
  
  await sendText(
    ctx.from,
    "📍 Location received!\n\n" +
    "💊 *Optional:* You can now:\n" +
    "• Share a photo of your prescription\n" +
    "• Type the medicine names you need\n" +
    "• Or just send \"search\" to search all pharmacies nearby"
  );
  
  // If AI agent enabled, can proceed immediately with location-only search
  if (isFeatureEnabled("agent.pharmacy")) {
    // User can choose to search now or provide medicine info
    // We'll wait for their response (handled in text router)
  }
  
  return true;
}
