import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { listMyBusinesses } from "./list.ts";

export async function handleCreateBusinessName(
  ctx: RouterContext,
  name: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Basic validation
  if (name.length < 3) {
    await sendTextMessage(
      ctx,
      "⚠️ Business name must be at least 3 characters long. Please try again.",
    );
    return true;
  }

  // Create the business
  const { error } = await ctx.supabase.from("businesses").insert({
    profile_id: ctx.profileId,
    name: name.trim(),
    description: "New business", // Default description
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
