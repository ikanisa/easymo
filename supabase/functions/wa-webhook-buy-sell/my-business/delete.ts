import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { listMyBusinesses } from "./list.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export async function confirmDeleteBusiness(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendButtonsMessage(
    ctx,
    "⚠️ *Delete Business*\n\nAre you sure you want to delete this business? This action cannot be undone.",
    [
      { id: `CONFIRM_DELETE_BIZ::${businessId}`, title: "🗑️ Yes, Delete" },
      { id: `BIZ::${businessId}`, title: "← Cancel" },
    ],
  );

  return true;
}

export async function handleDeleteBusiness(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("businesses")
    .delete()
    .eq("id", businessId)
    .eq("profile_id", ctx.profileId);

  if (error) {
    await logStructuredEvent("BUSINESS_DELETE_ERROR", {
      error: error.message,
      businessId,
      profileId: ctx.profileId,
    }, "error");
    await sendTextMessage(
      ctx,
      "⚠️ Failed to delete business. Please try again.",
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    "✅ Business deleted successfully.",
  );

  // Return to list
  return listMyBusinesses(ctx);
}
