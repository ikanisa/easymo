import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { listMyProperties } from "./list.ts";

export async function confirmDeleteProperty(
  ctx: RouterContext,
  propertyId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendButtonsMessage(
    ctx,
    "⚠️ *Delete Property Listing*\n\nAre you sure you want to delete this property listing? This action cannot be undone.",
    [
      { id: `CONFIRM_DELETE_PROP::${propertyId}`, title: "🗑️ Yes, Delete" },
      { id: `PROP::${propertyId}`, title: "← Cancel" },
    ],
  );

  return true;
}

export async function handleDeleteProperty(
  ctx: RouterContext,
  propertyId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("owner_id", ctx.profileId);

  if (error) {
    console.error("Failed to delete property:", error);
    await sendTextMessage(
      ctx,
      "⚠️ Failed to delete property listing. Please try again.",
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    "✅ Property listing deleted successfully.",
  );

  // Return to list
  return listMyProperties(ctx);
}
