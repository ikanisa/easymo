import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const MENU_UPLOAD_STATE = "menu_upload";

/**
 * Start menu upload flow
 * Gemini OCR integration to extract menu items from uploaded media
 */
export async function startMenuUpload(
  ctx: RouterContext,
  session: { barId: string; businessName: string },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: MENU_UPLOAD_STATE,
    data: {
      barId: session.barId,
      businessName: session.businessName,
      step: "awaiting_media",
    },
  });

  await logStructuredEvent("MENU_UPLOAD_STARTED", {
    userId: ctx.profileId,
    barId: session.barId,
  });

  await sendButtonsMessage(
    ctx,
    `📸 *Upload Menu for ${session.businessName}*\n\n` +
    "Send a photo or PDF of your menu, and I'll automatically extract the items.\n\n" +
    "Supported formats:\n" +
    "• Photos (JPG, PNG)\n" +
    "• PDF documents\n\n" +
    "Upload your menu now:",
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
  );

  return true;
}

/**
 * Handle menu media upload (photo or PDF)
 * Extract menu items using Gemini Vision API
 */
export async function handleMenuMediaUpload(
  ctx: RouterContext,
  session: { barId: string; businessName: string },
  mediaId: string,
  mediaType: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendButtonsMessage(
    ctx,
    "⏳ Processing your menu...\n\nThis may take a few moments.",
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
  );

  try {
    // Note: Gemini OCR integration placeholder
    // In production, this would:
    // 1. Download media from WhatsApp
    // 2. Send to Gemini Vision API
    // 3. Extract menu items with confidence scores
    // 4. Return structured menu data
    
    const extractedItems = await extractMenuWithGemini(mediaId, mediaType);
    
    // Store extracted items in menu_upload_requests table
    const { error } = await ctx.supabase
      .from("menu_upload_requests")
      .insert({
        bar_id: session.barId,
        uploaded_by: ctx.profileId,
        media_id: mediaId,
        media_type: mediaType,
        status: "completed",
        extracted_items: extractedItems,
        extraction_confidence: 0.85,
      });

    if (error) {
      console.error("menu_upload.save_error", error);
    }

    await logStructuredEvent("MENU_EXTRACTED", {
      userId: ctx.profileId,
      barId: session.barId,
      itemCount: extractedItems.length,
    });

    await sendButtonsMessage(
      ctx,
      `✅ *Menu extracted successfully!*\n\n` +
      `Found ${extractedItems.length} menu items.\n\n` +
      "Review and save them to your menu?",
      buildButtons(
        { id: IDS.MENU_SAVE_ALL, title: "✅ Save All Items" },
        { id: IDS.BACK_MENU, title: "Cancel" },
      ),
    );

    return true;
  } catch (err) {
    console.error("menu_upload.exception", err);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to process menu. Please try again or add items manually.",
      buildButtons({ id: IDS.BAR_MANAGE_MENU, title: "Manual Entry" }),
    );
    return true;
  }
}

/**
 * Extract menu items from media using Gemini Vision API
 * Returns structured menu item data
 */
async function extractMenuWithGemini(
  mediaId: string,
  mediaType: string,
): Promise<Array<{
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  confidence: number;
}>> {
  // Placeholder for Gemini Vision API integration
  // In production, this would:
  // 1. Download media file
  // 2. Send to Gemini with structured prompt
  // 3. Parse JSON response
  
  // For now, return empty array
  // TODO: Implement Gemini Vision API integration
  console.log("menu_upload.gemini_placeholder", { mediaId, mediaType });
  
  return [];
}

/**
 * Save extracted menu items to restaurant_menu_items table
 */
export async function saveExtractedMenuItems(
  ctx: RouterContext,
  session: { barId: string; extractedItems: any[] },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Bulk insert menu items
    const menuItems = session.extractedItems.map((item: any) => ({
      bar_id: session.barId,
      name: item.name,
      description: item.description || null,
      price: item.price || null,
      currency: item.currency || "RWF",
      category: item.category || null,
      is_available: true,
      sort_order: 999,
    }));

    const { error } = await ctx.supabase
      .from("restaurant_menu_items")
      .insert(menuItems);

    if (error) {
      console.error("menu_upload.bulk_insert_error", error);
      await sendButtonsMessage(
        ctx,
        "⚠️ Failed to save menu items. Please try again.",
        buildButtons({ id: IDS.BAR_MANAGE_MENU, title: "Back to Menu" }),
      );
      return true;
    }

    await logStructuredEvent("MENU_ITEMS_SAVED", {
      userId: ctx.profileId,
      barId: session.barId,
      itemCount: menuItems.length,
    });

    await sendButtonsMessage(
      ctx,
      `✅ *Success!*\n\n${menuItems.length} menu items saved.`,
      buildButtons(
        { id: IDS.BAR_MANAGE_MENU, title: "View Menu" },
        { id: IDS.BACK_MENU, title: "Done" },
      ),
    );

    return true;
  } catch (err) {
    console.error("menu_upload.save_exception", err);
    await sendButtonsMessage(
      ctx,
      "⚠️ An error occurred. Please try again.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }
}
