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
import { t } from "../../i18n/translator.ts";

export async function startNearbyPharmacies(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "pharmacy_awaiting_location",
    data: {},
  });
  
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "pharmacy.start.prompt"),
    buildButtons(
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
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
    t(ctx.locale, "pharmacy.location.received"),
    buildButtons(
      { id: "pharmacy_add_medicine", title: t(ctx.locale, "pharmacy.buttons.specify_medicine") },
      { id: "pharmacy_search_now", title: t(ctx.locale, "pharmacy.buttons.search_now") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    )
  );
  
  return true;
}
