import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage, sendText } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const MENU_MANAGE_STATE = "menu_manage";
export const MENU_ITEM_EDIT_STATE = "menu_item_edit";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  category: string;
  is_available: boolean;
  promotion_price: number | null;
  promotion_label: string | null;
}

/**
 * Show menu management list
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const MENU_EDIT_STATE = "menu_edit";

/**
 * Show menu management interface for a bar/restaurant
 */
export async function showMenuManagement(
  ctx: RouterContext,
  barId: string,
  businessName: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Fetch menu items grouped by category
  const { data: items, error } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("id, name, price, currency, category, is_available, promotion_price")
    .eq("bar_id", barId)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load menu items.",
      [{ id: `bar::${barId}`, title: "← Back" }]
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get menu items for this bar
  const { data: menuItems, error } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("id, name, price, currency, category, is_available")
    .eq("bar_id", barId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("menu_edit.fetch_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load menu. Please try again.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  if (!items || items.length === 0) {
    await sendButtonsMessage(
      ctx,
      `📋 *Menu for ${businessName}*\n\nNo menu items yet. Upload your menu to get started!`,
      [
        { id: IDS.BAR_UPLOAD_MENU, title: "📸 Upload Menu" },
        { id: IDS.MENU_ITEM_ADD, title: "➕ Add Item Manually" },
        { id: `bar::${barId}`, title: "← Back" },
      ]
  if (!menuItems || menuItems.length === 0) {
    await sendButtonsMessage(
      ctx,
      `📋 *Menu for ${businessName}*\n\nNo menu items yet.`,
      buildButtons(
        { id: IDS.BAR_UPLOAD_MENU, title: "📸 Upload Menu" },
        { id: IDS.BACK_MENU, title: "Back" },
      ),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: MENU_MANAGE_STATE,
    data: { barId, businessName, items: items.map(i => i.id) },
  });

  // Build list rows (max 10 per WhatsApp limit)
  const rows = items.slice(0, 9).map((item) => {
    const priceDisplay = item.promotion_price
      ? `~${item.price}~ ${item.promotion_price} ${item.currency}`
      : `${item.price.toLocaleString()} ${item.currency}`;
    const availability = item.is_available ? "" : " ⛔";
    
    return {
      id: `menuitem::${item.id}`,
      title: `${item.name}${availability}`.slice(0, 24),
      description: `${item.category} • ${priceDisplay}`.slice(0, 72),
    };
  });

  // Add control rows
  rows.push({
    id: IDS.MENU_ITEM_ADD,
    title: "➕ Add New Item",
    description: "Manually add a menu item",
  });

  if (items.length > 9) {
    rows.push({
      id: IDS.MENU_VIEW_ALL,
      title: `📋 View All (${items.length})`,
      description: "See complete menu list",
    });
  }

  await sendListMessage(ctx, {
    title: `📋 ${businessName} Menu`,
    body: `${items.length} items\n\nTap an item to edit, or add new items:`,
    sectionTitle: "Menu Items",
    buttonText: "Select Item",
    rows,
  });
  const rows = menuItems.slice(0, 10).map((item) => ({
    id: `menuitem::${item.id}`,
    title: `${item.is_available ? "✅" : "❌"} ${item.name.substring(0, 20)}`,
    description: `${item.price ? `${item.price} ${item.currency || "RWF"}` : "No price"} • ${item.category || "Uncategorized"}`,
  }));

  rows.push({
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to bar management",
  });

  await sendListMessage(
    ctx,
    {
      title: `📋 Menu - ${businessName}`,
      body: `${menuItems.length} menu items\n\nSelect an item to edit, or go back.`,
      sectionTitle: "Menu Items",
      rows,
      buttonText: "Select",
    },
    { emoji: "📋" },
  );

  return true;
}

/**
 * Show menu item detail for editing
 */
export async function showMenuItemDetail(
  ctx: RouterContext,
  itemId: string
 * Show detail view for a specific menu item
 */
export async function showMenuItemDetail(
  ctx: RouterContext,
  itemId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item, error } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Menu item not found.",
      [{ id: IDS.BAR_MANAGE_MENU, title: "← Back" }]
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: MENU_ITEM_EDIT_STATE,
    data: { itemId, barId: item.bar_id },
  });

  const promoInfo = item.promotion_price
    ? `\n🏷️ *PROMO:* ${item.promotion_price} ${item.currency} (was ${item.price})`
    : "";
  
  const availabilityIcon = item.is_available ? "✅" : "⛔";

  await sendListMessage(ctx, {
    title: `✏️ Edit: ${item.name}`,
    body: `*${item.name}*\n\n` +
      `📂 Category: ${item.category}\n` +
      `💰 Price: ${item.price.toLocaleString()} ${item.currency}${promoInfo}\n` +
      `📝 ${item.description || "No description"}\n` +
      `${availabilityIcon} ${item.is_available ? "Available" : "Unavailable"}\n\n` +
      `What would you like to change?`,
    sectionTitle: "Edit Options",
    buttonText: "Select Action",
    rows: [
      { id: IDS.MENU_EDIT_NAME, title: "✏️ Edit Name", description: `Current: ${item.name}` },
      { id: IDS.MENU_EDIT_PRICE, title: "💰 Edit Price", description: `Current: ${item.price} ${item.currency}` },
      { id: IDS.MENU_EDIT_DESC, title: "📝 Edit Description", description: item.description?.slice(0, 40) || "Add description" },
      { id: IDS.MENU_EDIT_CATEGORY, title: "📂 Change Category", description: `Current: ${item.category}` },
      { id: IDS.MENU_TOGGLE_AVAILABLE, title: item.is_available ? "⛔ Mark Unavailable" : "✅ Mark Available", description: "Toggle availability" },
      { id: IDS.MENU_SET_PROMO, title: "🏷️ Set Promotion", description: item.promotion_price ? "Edit promo" : "Add promo price" },
      { id: IDS.MENU_DELETE_ITEM, title: "🗑️ Delete Item", description: "Remove from menu" },
      { id: IDS.BAR_MANAGE_MENU, title: "← Back to Menu", description: "Return to menu list" },
    ],
  });

  return true;
}

/**
 * Toggle menu item availability
 */
export async function toggleMenuItemAvailability(
  ctx: RouterContext,
  itemId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get current status
  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name, is_available, bar_id")
    .eq("id", itemId)
    .single();

  if (!item) return false;

  // Toggle
  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ is_available: !item.is_available, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to update availability.");
    return true;
  }

  const newStatus = !item.is_available;
  
  await logStructuredEvent("MENU_ITEM_AVAILABILITY_TOGGLED", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
    isAvailable: newStatus,
  });

  await sendButtonsMessage(
    ctx,
    `${newStatus ? "✅" : "⛔"} *${item.name}* is now ${newStatus ? "available" : "unavailable"}`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
    key: MENU_EDIT_STATE,
    data: { itemId, itemName: item.name },
  });

  const details = [
    `📝 *${item.name}*`,
    item.description ? `\n${item.description}` : "",
    `\n💰 Price: ${item.price ? `${item.price} ${item.currency || "RWF"}` : "Not set"}`,
    `📂 Category: ${item.category || "None"}`,
    `${item.is_available ? "✅ Available" : "❌ Unavailable"}`,
    item.promotion_price ? `\n🎉 Promo: ${item.promotion_price} ${item.currency} - ${item.promotion_label}` : "",
  ].filter(Boolean).join("\n");

  const rows = [
    {
      id: IDS.MENU_TOGGLE_AVAILABLE,
      title: item.is_available ? "❌ Mark Unavailable" : "✅ Mark Available",
      description: "Toggle availability",
    },
    {
      id: IDS.MENU_SET_PROMO,
      title: "🎉 Set Promotion",
      description: "Add promotional pricing",
    },
    {
      id: IDS.MENU_DELETE_ITEM,
      title: "🗑️ Delete Item",
      description: "Remove from menu",
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "Back to menu list",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: "Menu Item",
      body: details,
      sectionTitle: "Actions",
      rows,
      buttonText: "Select",
    },
    { emoji: "📝" },
  );

  return true;
}

/**
 * Update menu item price
 */
export async function updateMenuItemPrice(
  ctx: RouterContext,
  itemId: string,
  newPrice: number
 * Toggle menu item availability
 */
export async function toggleMenuItemAvailability(
  ctx: RouterContext,
  itemId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name, currency")
    .select("is_available, name")
    .eq("id", itemId)
    .single();

  if (!item) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ price: newPrice, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to update price.");
    return true;
  }

  await logStructuredEvent("MENU_ITEM_PRICE_UPDATED", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
    newPrice,
  const newAvailability = !item.is_available;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ is_available: newAvailability })
    .eq("id", itemId);

  if (error) {
    console.error("menu_edit.toggle_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to update item.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  await logStructuredEvent("MENU_ITEM_TOGGLED", {
    userId: ctx.profileId,
    itemId,
    newAvailability,
  });

  await sendButtonsMessage(
    ctx,
    `💰 *Price Updated!*\n\n*${item.name}* is now ${newPrice.toLocaleString()} ${item.currency}`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
    `✅ *${item.name}* is now ${newAvailability ? "available" : "unavailable"}.`,
    buildButtons(
      { id: `menuitem::${itemId}`, title: "View Item" },
      { id: IDS.BACK_MENU, title: "Done" },
    ),
  );

  return true;
}

/**
 * Set promotion price for menu item
 * Set promotional pricing for menu item
 */
export async function setMenuItemPromotion(
  ctx: RouterContext,
  itemId: string,
  promoPrice: number,
  promoLabel?: string,
  endDate?: Date
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name, price, currency")
    .eq("id", itemId)
    .single();

  if (!item) return false;

  promoLabel: string,
  endDate: string | null,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({
      promotion_price: promoPrice,
      promotion_label: promoLabel || "Special Offer",
      promotion_end_date: endDate?.toISOString() || null,
      updated_at: new Date().toISOString(),
      promotion_label: promoLabel,
      promotion_end_date: endDate,
    })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to set promotion.");
    return true;
  }

  await logStructuredEvent("MENU_ITEM_PROMO_SET", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
    originalPrice: item.price,
    promoPrice,
  });

  await sendButtonsMessage(
    ctx,
    `🏷️ *Promotion Set!*\n\n*${item.name}*\n~${item.price}~ → ${promoPrice} ${item.currency}\n\nCustomers will see the discounted price!`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
  );

    console.error("menu_edit.promo_error", error);
    return false;
  }

  await logStructuredEvent("MENU_ITEM_PROMOTION_SET", {
    userId: ctx.profileId,
    itemId,
    promoPrice,
  });

  return true;
}

/**
 * Delete menu item
 */
export async function deleteMenuItem(
  ctx: RouterContext,
  itemId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name, bar_id")
    .eq("id", itemId)
    .single();

  if (!item) return false;

 * Delete a menu item
 */
export async function deleteMenuItem(
  ctx: RouterContext,
  itemId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to delete item.");
    console.error("menu_edit.delete_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to delete item.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  await logStructuredEvent("MENU_ITEM_DELETED", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
  });

  await sendButtonsMessage(
    ctx,
    `🗑️ *${item.name}* has been removed from your menu.`,
    [{ id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" }]
  );

  return true;
}

/**
 * Update menu item name
 */
export async function updateMenuItemName(
  ctx: RouterContext,
  itemId: string,
  newName: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to update name.");
    return true;
  }

  await logStructuredEvent("MENU_ITEM_NAME_UPDATED", {
    userId: ctx.profileId,
    itemId,
    newName,
  });

  await sendButtonsMessage(
    ctx,
    `✅ Name updated to: *${newName}*`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
  );

  return true;
}

/**
 * Update menu item description
 */
export async function updateMenuItemDescription(
  ctx: RouterContext,
  itemId: string,
  newDescription: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name")
    .eq("id", itemId)
    .single();

  if (!item) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ description: newDescription, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to update description.");
    return true;
  }

  await logStructuredEvent("MENU_ITEM_DESCRIPTION_UPDATED", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
  });

  await sendButtonsMessage(
    ctx,
    `✅ Description updated for *${item.name}*`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
  );

  return true;
}

/**
 * Update menu item category
 */
export async function updateMenuItemCategory(
  ctx: RouterContext,
  itemId: string,
  newCategory: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("name")
    .eq("id", itemId)
    .single();

  if (!item) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({ category: newCategory, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    await sendText(ctx.from, "⚠️ Failed to update category.");
    return true;
  }

  await logStructuredEvent("MENU_ITEM_CATEGORY_UPDATED", {
    userId: ctx.profileId,
    itemId,
    itemName: item.name,
    newCategory,
  });

  await sendButtonsMessage(
    ctx,
    `✅ *${item.name}* moved to category: *${newCategory}*`,
    [
      { id: `menuitem::${itemId}`, title: "✏️ Edit More" },
      { id: IDS.BAR_MANAGE_MENU, title: "📋 Back to Menu" },
    ]
    "✅ Menu item deleted successfully.",
    buildButtons({ id: IDS.BAR_MANAGE_MENU, title: "Back to Menu" }),
  );

  return true;
}
