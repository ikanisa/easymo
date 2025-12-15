import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { handleBusinessSelection } from "./list.ts";

export async function startEditBusiness(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendListMessage(
    ctx,
    {
      title: "✏️ Edit Business",
      body: "What would you like to update?",
      sectionTitle: "Fields",
      buttonText: "Select Field",
      rows: [
        {
          id: `EDIT_BIZ_NAME::${businessId}`,
          title: "Name",
          description: "Change business name",
        },
        {
          id: `EDIT_BIZ_DESC::${businessId}`,
          title: "Description",
          description: "Update description",
        },
        {
          id: `BACK_BIZ::${businessId}`,
          title: "← Back",
          description: "Return to business details",
        },
      ],
    },
    { emoji: "✏️" },
  );

  return true;
}

export async function promptEditField(
  ctx: RouterContext,
  businessId: string,
  field: "name" | "description",
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const stateKey = `business_edit_${field}`;
  await setState(ctx.supabase, ctx.profileId, {
    key: stateKey,
    data: { businessId },
  });

  const prompts = {
    name: "Enter the new name for your business:",
    description: "Enter the new description for your business:",
  };

  await sendButtonsMessage(
    ctx,
    `✏️ *Edit ${field.charAt(0).toUpperCase() + field.slice(1)}*\n\n${prompts[field]}`,
    [{ id: `BACK_BIZ::${businessId}`, title: "← Cancel" }],
  );

  return true;
}

export async function handleUpdateBusinessField(
  ctx: RouterContext,
  businessId: string,
  field: "name" | "description",
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedValue = value.trim();

  // Input validation
  if (trimmedValue.length < 2) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} must be at least 2 characters long. Please try again.`,
    );
    return true;
  }

  if (trimmedValue.length > (field === "name" ? 100 : 500)) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} is too long. Please keep it under ${field === "name" ? 100 : 500} characters.`,
    );
    return true;
  }

  const updates: Record<string, unknown> = { [field]: trimmedValue, updated_at: new Date().toISOString() };

  const { error } = await ctx.supabase
    .from("businesses")
    .update(updates)
    .eq("id", businessId)
    .eq("profile_id", ctx.profileId);

  if (error) {
    console.error(`Failed to update business ${field}:`, error);
    await sendTextMessage(
      ctx,
      `⚠️ Failed to update business ${field}. Please try again.`,
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    `✅ Business ${field} updated successfully!`,
  );

  // Return to business details
  return handleBusinessSelection(ctx, businessId);
}
