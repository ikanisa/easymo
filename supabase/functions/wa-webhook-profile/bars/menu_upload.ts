import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage, sendText } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const MENU_UPLOAD_STATE = "menu_upload";
export const MENU_REVIEW_STATE = "menu_review";

interface ExtractedMenuItem {
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  confidence: number;
}

interface MenuUploadSession {
  barId: string;
  businessId: string;
  businessName: string;
  mediaId?: string;
  mediaUrl?: string;
  extractedItems?: ExtractedMenuItem[];
  selectedItems?: string[];
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");

/**
 * Start menu upload flow
 */
export async function startMenuUpload(
  ctx: RouterContext,
  session: { businessId: string; businessName: string; barId?: string }
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
      barId: session.barId || session.businessId,
      businessId: session.businessId,
      businessName: session.businessName,
    } as MenuUploadSession,
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
    `Send me a photo or PDF of your menu and I'll automatically extract all items using AI.\n\n` +
    `*Supported formats:*\n` +
    `• 📷 Photo of menu\n` +
    `• 📄 PDF menu file\n` +
    `• 🖼️ Image file\n\n` +
    `_Just send the file as a message_`,
    [
      { id: IDS.BAR_MANAGE_MENU, title: "📋 View Current Menu" },
      { id: `bar::${session.businessId}`, title: "← Back" },
    ]
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
 * Handle media upload for menu extraction
 */
export async function handleMenuMediaUpload(
  ctx: RouterContext,
  session: MenuUploadSession,
  mediaId: string,
  mediaType: "image" | "document"
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendText(ctx.from, "⏳ Processing your menu... This may take a few seconds.");

  try {
    // 1. Download media from WhatsApp
    const mediaUrl = await downloadWhatsAppMedia(mediaId);
    
    if (!mediaUrl) {
      throw new Error("Failed to download media");
    }

    // 2. Create upload request record
    const { data: uploadRequest } = await ctx.supabase
      .from("menu_upload_requests")
      .insert({
        bar_id: session.barId,
        user_id: ctx.profileId,
        media_id: mediaId,
        media_url: mediaUrl,
        media_type: mediaType,
        processing_status: "processing",
      })
      .select("id")
      .single();

    // 3. Extract menu items with Gemini
    const extractedItems = await extractMenuWithGemini(mediaUrl, mediaType);

    if (!extractedItems || extractedItems.length === 0) {
      await ctx.supabase
        .from("menu_upload_requests")
        .update({ 
          processing_status: "failed",
          error_message: "No menu items could be extracted",
        })
        .eq("id", uploadRequest?.id);

      await sendButtonsMessage(
        ctx,
        "😕 *No menu items found*\n\nI couldn't extract any items from this image. Please try:\n• A clearer photo\n• Better lighting\n• A different angle",
        [
          { id: IDS.BAR_UPLOAD_MENU, title: "📸 Try Again" },
          { id: `bar::${session.businessId}`, title: "← Back" },
        ]
      );
      return true;
    }

    // 4. Update upload request with extracted items
    await ctx.supabase
      .from("menu_upload_requests")
      .update({
        processing_status: "completed",
        extracted_items: extractedItems,
        item_count: extractedItems.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", uploadRequest?.id);

    // 5. Show extracted items for review
    await setState(ctx.supabase, ctx.profileId, {
      key: MENU_REVIEW_STATE,
      data: {
        ...session,
        extractedItems,
        selectedItems: extractedItems.map((_, i) => String(i)),
      },
    });

    await logStructuredEvent("MENU_EXTRACTED", {
      userId: ctx.profileId,
      businessId: session.businessId,
      itemCount: extractedItems.length,
    });

    return await showMenuReview(ctx, session.businessName, extractedItems);

  } catch (error) {
    console.error("menu_upload.error", error);
    
    await sendButtonsMessage(
      ctx,
      "⚠️ *Processing Failed*\n\nSorry, I couldn't process your menu. Please try again with a different image.",
      [
        { id: IDS.BAR_UPLOAD_MENU, title: "📸 Try Again" },
        { id: `bar::${session.businessId}`, title: "← Back" },
      ]
    );
    return true;
  }
}

/**
 * Download media from WhatsApp API
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<string | null> {
  try {
    // Get media URL from WhatsApp
    const mediaInfoRes = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
      }
    );
    
    const mediaInfo = await mediaInfoRes.json();
    if (!mediaInfo.url) return null;

    // Download the actual file
    const fileRes = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
    });

    const blob = await fileRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return `data:${mediaInfo.mime_type};base64,${base64}`;
  } catch (error) {
    console.error("download_media.error", error);
    return null;
  }
}

/**
 * Extract menu items using Gemini 2.0 Flash
 */
async function extractMenuWithGemini(
  mediaDataUrl: string,
  mediaType: "image" | "document"
): Promise<ExtractedMenuItem[]> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured");
    return [];
  }

  const prompt = `
You are a menu extraction AI. Analyze this menu image/document and extract ALL menu items.

For each item, provide:
- name: The item name (required)
- description: Brief description if visible (optional)
- price: The price as a number (required, extract digits only)
- currency: Currency code (default "RWF" for Rwanda, "EUR" for Europe)
- category: Category like "Drinks", "Food", "Appetizers", "Main Course", "Desserts", "Cocktails", "Beer", "Wine", etc.
- confidence: Your confidence in the extraction (0.0-1.0)

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {"name": "Heineken", "price": 2500, "currency": "RWF", "category": "Beer", "confidence": 0.95},
  {"name": "Chicken Wings", "description": "Spicy buffalo wings", "price": 5000, "currency": "RWF", "category": "Appetizers", "confidence": 0.9}
]

Extract ALL visible items. If price is unclear, estimate based on similar items or use 0.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3:generateContent?key=${GEMINI_API_KEY}`,  // Per README.md: Mandatory Gemini-3
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mediaDataUrl.split(";")[0].replace("data:", ""),
                    data: mediaDataUrl.split(",")[1],
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.95,
          },
        }),
      }
    );

    const data = await response.json();
    let jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!jsonStr) return [];

    // Clean markdown if present
    jsonStr = jsonStr
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "");

    const items = JSON.parse(jsonStr);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error("gemini_extraction.error", error);
    return [];
  }
}

/**
 * Show extracted menu items for review
 */
async function showMenuReview(
  ctx: RouterContext,
  businessName: string,
  items: ExtractedMenuItem[]
): Promise<boolean> {
  // Group by category
  const categories = [...new Set(items.map((i) => i.category))];
  
  let summary = `✅ *Extracted ${items.length} items from ${businessName}*\n\n`;
  
  categories.forEach((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    summary += `*${cat}* (${catItems.length})\n`;
    catItems.slice(0, 3).forEach((item) => {
      summary += `  • ${item.name} - ${item.price.toLocaleString()} ${item.currency}\n`;
    });
    if (catItems.length > 3) {
      summary += `  _... and ${catItems.length - 3} more_\n`;
    }
    summary += "\n";
  });

  summary += `\n*Ready to save these items to your menu?*`;

  await sendButtonsMessage(
    ctx,
    summary,
    [
      { id: IDS.MENU_SAVE_ALL, title: `✅ Save All (${items.length})` },
      { id: IDS.MENU_REVIEW_ITEMS, title: "📝 Review & Edit" },
      { id: IDS.BAR_UPLOAD_MENU, title: "🔄 Upload Different" },
    ]
  );

  return true;
}

/**
 * Save extracted menu items to database
 */
export async function saveExtractedMenuItems(
  ctx: RouterContext,
  session: MenuUploadSession
): Promise<boolean> {
  if (!ctx.profileId || !session.extractedItems) return false;

  const items = session.extractedItems;
  const barId = session.barId;

  // Insert all items
  const menuItems = items.map((item, idx) => ({
    bar_id: barId,
    name: item.name,
    description: item.description || null,
    price: item.price,
    currency: item.currency || "RWF",
    category: item.category,
    is_available: true,
    ocr_extracted: true,
    ocr_confidence: item.confidence,
    sort_order: idx,
    created_by: ctx.from,
  }));

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .insert(menuItems);

  if (error) {
    console.error("menu_save.error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to save menu items. Please try again.",
      [{ id: `bar::${session.businessId}`, title: "← Back" }]
    );
    return true;
  }

  await clearState(ctx.supabase, ctx.profileId);

  await logStructuredEvent("MENU_ITEMS_SAVED", {
    userId: ctx.profileId,
    businessId: session.businessId,
    itemCount: items.length,
  });

  await sendButtonsMessage(
    ctx,
    `✅ *Menu Saved Successfully!*\n\n${items.length} items have been added to your menu.\n\nCustomers can now order from your menu via WhatsApp!`,
    [
      { id: IDS.BAR_MANAGE_MENU, title: "📋 View Menu" },
      { id: IDS.BAR_VIEW_ORDERS, title: "📦 View Orders" },
      { id: `bar::${session.businessId}`, title: "← Back" },
    ]
  );

  return true;
}

/**
 * Show detailed review of extracted items (paginated)
 */
export async function showDetailedMenuReview(
  ctx: RouterContext,
  items: ExtractedMenuItem[],
  page: number = 0
): Promise<boolean> {
  const pageSize = 8;
  const startIdx = page * pageSize;
  const endIdx = Math.min(startIdx + pageSize, items.length);
  const pageItems = items.slice(startIdx, endIdx);

  const rows = pageItems.map((item, idx) => ({
    id: `menuitem_review::${startIdx + idx}`,
    title: `${item.name.slice(0, 24)}`,
    description: `${item.category} • ${item.price} ${item.currency}`.slice(0, 72),
  }));

  // Add navigation
  if (endIdx < items.length) {
    rows.push({
      id: `menu_review_page::${page + 1}`,
      title: "▶️ Next Page",
      description: `Show items ${endIdx + 1}-${Math.min(endIdx + pageSize, items.length)}`,
    });
  }

  if (page > 0) {
    rows.push({
      id: `menu_review_page::${page - 1}`,
      title: "◀️ Previous Page",
      description: `Show items ${startIdx - pageSize + 1}-${startIdx}`,
    });
  }

  rows.push({
    id: IDS.MENU_SAVE_ALL,
    title: `✅ Save All (${items.length})`,
    description: "Save all extracted items",
  });

  await sendListMessage(ctx, {
    title: `📋 Review Menu Items (${startIdx + 1}-${endIdx} of ${items.length})`,
    body: `Tap an item to edit, or save all items:`,
    sectionTitle: "Extracted Items",
    buttonText: "Select",
    rows,
  });

  return true;
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
