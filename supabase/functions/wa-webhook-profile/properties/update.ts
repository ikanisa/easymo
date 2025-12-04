import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { handlePropertySelection } from "./list.ts";

export async function startEditProperty(
  ctx: RouterContext,
  propertyId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendListMessage(
    ctx,
    {
      title: "✏️ Edit Property",
      body: "What would you like to update?",
      sectionTitle: "Fields",
      buttonText: "Select Field",
      rows: [
        {
          id: `EDIT_PROP_TITLE::${propertyId}`,
          title: "Title",
          description: "Change property title",
        },
        {
          id: `EDIT_PROP_DESC::${propertyId}`,
          title: "Description",
          description: "Update description",
        },
        {
          id: `EDIT_PROP_LOC::${propertyId}`,
          title: "Location",
          description: "Update property location",
        },
        {
          id: `EDIT_PROP_PRICE::${propertyId}`,
          title: "Price",
          description: "Update property price",
        },
        {
          id: `BACK_PROP::${propertyId}`,
          title: "← Back",
          description: "Return to property details",
        },
      ],
    },
    { emoji: "✏️" },
  );

  return true;
}

export async function promptEditPropertyField(
  ctx: RouterContext,
  propertyId: string,
  field: "title" | "description" | "location" | "price",
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const stateKey = `property_edit_${field}`;
  await setState(ctx.supabase, ctx.profileId, {
    key: stateKey,
    data: { propertyId },
  });

  const prompts = {
    title: "Enter the new title for this property:",
    description: "Enter the new description for this property:",
    location: "Enter the new location for this property:",
    price: "Enter the new price for this property (numbers only):",
  };

  await sendButtonsMessage(
    ctx,
    `✏️ *Edit ${field.charAt(0).toUpperCase() + field.slice(1)}*\n\n${prompts[field]}`,
    [{ id: `BACK_PROP::${propertyId}`, title: "← Cancel" }],
  );

  return true;
}

export async function handleUpdatePropertyField(
  ctx: RouterContext,
  propertyId: string,
  field: "title" | "description" | "location" | "price",
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedValue = value.trim();

  // Input validation - minimum length (except price which needs special handling)
  if (field !== "price" && trimmedValue.length < 2) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} must be at least 2 characters long. Please try again.`,
    );
    return true;
  }

  // Field-specific length limits
  const maxLengths: Record<string, number> = {
    title: 150,
    description: 1000,
    location: 200,
  };

  if (field !== "price" && trimmedValue.length > maxLengths[field]) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} is too long. Please keep it under ${maxLengths[field]} characters.`,
    );
    return true;
  }

  let updateValue: unknown = trimmedValue;
  if (field === "price") {
    const num = parseInt(trimmedValue.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num) || num < 0) {
      await sendTextMessage(
        ctx,
        "⚠️ Invalid price. Please enter a valid positive number.",
      );
      return true;
    }
    // Reasonable price limit (100 billion RWF)
    if (num > 100_000_000_000) {
      await sendTextMessage(
        ctx,
        "⚠️ Price seems too high. Please enter a reasonable price.",
      );
      return true;
    }
    updateValue = num;
  }

  const updates: Record<string, unknown> = { [field]: updateValue, updated_at: new Date().toISOString() };

  const { error } = await ctx.supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .eq("owner_id", ctx.profileId);

  if (error) {
    console.error(`Failed to update property ${field}:`, error);
    await sendTextMessage(
      ctx,
      `⚠️ Failed to update property ${field}. Please try again.`,
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    `✅ Property ${field} updated successfully!`,
  );

  // Return to property details
  return handlePropertySelection(ctx, propertyId);
}
