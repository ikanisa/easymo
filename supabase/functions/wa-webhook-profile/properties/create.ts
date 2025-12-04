import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { listMyProperties } from "./list.ts";

export async function startCreateProperty(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_create_title",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    "🏠 *List New Property*\n\nWhat is the title of your property listing?",
    [{ id: IDS.BACK_PROFILE, title: "← Cancel" }],
  );

  return true;
}

export async function handleCreatePropertyTitle(
  ctx: RouterContext,
  title: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedTitle = title.trim();

  // Basic validation - minimum length
  if (trimmedTitle.length < 3) {
    await sendTextMessage(
      ctx,
      "⚠️ Property title must be at least 3 characters long. Please try again.",
    );
    return true;
  }

  // Maximum length validation  
  if (trimmedTitle.length > 150) {
    await sendTextMessage(
      ctx,
      "⚠️ Property title must be less than 150 characters. Please try again.",
    );
    return true;
  }

  // Create the property
  const { error } = await ctx.supabase.from("properties").insert({
    owner_id: ctx.profileId,
    title: trimmedTitle,
    description: "New property listing", // Default description
    status: "active",
  });

  if (error) {
    console.error("Failed to create property:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to create property listing. Please try again.",
      [{ id: IDS.MY_PROPERTIES, title: "← Back" }],
    );
    return true;
  }

  // Clear state
  await clearState(ctx.supabase, ctx.profileId);

  // Confirm and show list
  await sendTextMessage(
    ctx,
    `✅ Property *${title}* listed successfully!`,
  );

  // Return to list
  return listMyProperties(ctx);
}
