import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
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
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
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
 * Toggle menu item availability
 */
export async function toggleMenuItemAvailability(
  ctx: RouterContext,
  itemId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: item } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("is_available, name")
    .eq("id", itemId)
    .single();

  if (!item) return false;

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
    `✅ *${item.name}* is now ${newAvailability ? "available" : "unavailable"}.`,
    buildButtons(
      { id: `menuitem::${itemId}`, title: "View Item" },
      { id: IDS.BACK_MENU, title: "Done" },
    ),
  );

  return true;
}

/**
 * Set promotional pricing for menu item
 */
export async function setMenuItemPromotion(
  ctx: RouterContext,
  itemId: string,
  promoPrice: number,
  promoLabel: string,
  endDate: string | null,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("restaurant_menu_items")
    .update({
      promotion_price: promoPrice,
      promotion_label: promoLabel,
      promotion_end_date: endDate,
    })
    .eq("id", itemId);

  if (error) {
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
  });

  await sendButtonsMessage(
    ctx,
    "✅ Menu item deleted successfully.",
    buildButtons({ id: IDS.BAR_MANAGE_MENU, title: "Back to Menu" }),
  );

  return true;
}
