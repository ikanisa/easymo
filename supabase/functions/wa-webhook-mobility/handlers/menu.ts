/**
 * Menu Handler for Mobility Webhook
 * 
 * Handles the main mobility menu display and navigation.
 */

import type { RouterContext } from "../types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../wa/ids.ts";
import { supabase } from "../config.ts";

/**
 * Show the main mobility menu
 */
export async function showMobilityMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(supabase, ctx.profileId, { key: "mobility_menu", data: {} });
  
  const rows = [
    {
      id: IDS.SEE_DRIVERS,
      title: "🚖 Nearby drivers",
      description: "Request riders close to your location.",
    },
    {
      id: IDS.SEE_PASSENGERS,
      title: "🧍 Nearby passengers",
      description: "Drivers find people needing a ride.",
    },
    {
      id: IDS.SCHEDULE_TRIP,
      title: "🗓️ Schedule trip",
      description: "Plan a future pickup with reminders.",
    },
    {
      id: IDS.GO_ONLINE,
      title: "🟢 Go online",
      description: "Share your location to receive ride offers.",
    },
  ];
  
  await sendListMessage(
    ctx,
    {
      title: "🚗 Mobility",
      body: "Choose what you need help with.",
      sectionTitle: "Options",
      rows,
      buttonText: "Open",
    },
    { emoji: "🚗" },
  );
  
  return true;
}

