import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { listMyBusinesses } from "./list.ts";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";

export async function handleCreateBusinessName(
  ctx: RouterContext,
  name: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedName = name.trim();

  // Basic validation
  if (trimmedName.length < 3) {
    await sendTextMessage(
      ctx,
      "⚠️ Business name must be at least 3 characters long. Please try again.",
    );
    return true;
  }

  // Length validation (WhatsApp list item titles have character limits)
  if (trimmedName.length > 100) {
    await sendTextMessage(
      ctx,
      "⚠️ Business name must be less than 100 characters. Please try again.",
    );
    return true;
  }

  // Create the business - use profile_id to match list.ts query
  const { error } = await ctx.supabase.from("businesses").insert({
    profile_id: ctx.profileId,
    name: trimmedName,
    description: "New business", // Default description
    status: "active",
  });

  if (error) {
    console.error("Failed to create business:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to create business. Please try again.",
      [{ id: IDS.BACK_BUSINESSES, title: "← Cancel" }],
    );
    return true;
  }

  // Log success and metrics
  await logStructuredEvent("BUY_SELL_BUSINESS_CREATED", {
    profileId: ctx.profileId,
    businessName: trimmedName,
    from: `***${ctx.from.slice(-4)}`,
  });
  
  await recordMetric("buy_sell.business.created", 1, {
    nameLength: trimmedName.length,
  });

  // Clear state
  await clearState(ctx.supabase, ctx.profileId);

  // Confirm and show list
  await sendTextMessage(
    ctx,
    `✅ Business *${name}* created successfully!`,
  );

  // Return to list
  return listMyBusinesses(ctx);
}
