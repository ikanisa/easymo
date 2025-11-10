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
import { sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAINearbyPharmacies } from "../ai-agents/index.ts";
import { IDS } from "../../wa/ids.ts";

export async function startNearbyPharmacies(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "pharmacy_awaiting_location",
    data: {},
  });
  
  await sendButtonsMessage(
    ctx,
    "💊 *Nearby Pharmacies*\n\n" +
    "Share your location to find pharmacies near you.\n\n" +
    "📍 Tap the button below to share your location, or use the attachment icon.",
    buildButtons(
      { id: "pharmacy_share_location", title: "📍 Share Location" },
      { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
    )
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
  
  await sendButtonsMessage(
    ctx,
    "📍 *Location received!*\n\n" +
    "💊 What would you like to do?",
    buildButtons(
      { id: "pharmacy_search_all", title: "🔍 Search All Pharmacies" },
      { id: "pharmacy_add_medicine", title: "💊 Specify Medicines" },
      { id: IDS.BACK_HOME, title: "🏠 Cancel" }
    )
  );
  
  return true;
}
