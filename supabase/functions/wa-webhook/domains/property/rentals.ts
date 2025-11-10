/**
 * Property Rentals Flow
 * 
 * User flow:
 * Option A - Add Property: Collect criteria → Save to DB (NO AI)
 * Option B - Find Property: Collect search criteria → AI Agent
 */

import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { sendListMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";

export async function startPropertyRentals(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "property_menu",
    data: {},
  });
  
  await sendListMessage(
    ctx,
    {
      title: "🏠 Property Rentals",
      body: "Find or add rental properties",
      sectionTitle: "Choose an option",
      buttonText: "View options",
      rows: [
        {
          id: IDS.PROPERTY_FIND,
          title: "🔍 Find Property",
          description: "Search for rental properties",
        },
        {
          id: IDS.PROPERTY_ADD,
          title: "➕ Add Property",
          description: "List your property for rent",
        },
        {
          id: IDS.BACK_HOME,
          title: "🏠 Back to Home",
          description: "Return to main menu",
        },
      ],
    },
    { emoji: "🏠" },
  );
  
  return true;
}
