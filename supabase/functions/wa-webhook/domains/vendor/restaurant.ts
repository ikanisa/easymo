import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { sendText } from "../../wa/client.ts";

export type RestaurantManagerState = {
  barId?: string;
  action?: "view_menu" | "upload_menu" | "edit_menu" | "view_orders";
  uploadRequestId?: string;
};

// Check if user is a restaurant/bar manager
export async function isBarManager(
  ctx: RouterContext,
  targetBarId?: string,
): Promise<{ isManager: boolean; barId?: string }> {
  if (!ctx.profileId) return { isManager: false };

  let query = ctx.supabase
    .from("bar_managers")
    .select("bar_id, is_active")
    .eq("user_id", ctx.profileId)
    .eq("is_active", true);
  if (targetBarId) {
    query = query.eq("bar_id", targetBarId);
  }
  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { isManager: false };
  }

  return { isManager: true, barId: data.bar_id };
}

// Start restaurant manager menu
export async function startRestaurantManager(
  ctx: RouterContext,
  options: { barId?: string; initialAction?: "menu" | "orders" } = {},
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { barId: forcedBarId, initialAction } = options;
  const { isManager, barId } = await isBarManager(ctx, forcedBarId);

  if (!isManager) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "restaurant.not_manager"),
      homeOnly(),
    );
    return true;
  }

  const resolvedBarId = forcedBarId ?? barId;

  await setState(ctx.supabase, ctx.profileId, {
    key: "restaurant_manager",
    data: { barId: resolvedBarId },
  });

  if (initialAction === "menu") {
    return await showCurrentMenu(ctx, { barId: resolvedBarId });
  }
  if (initialAction === "orders") {
    return await showOrders(ctx, { barId: resolvedBarId });
  }

  const rows = [
    {
      id: "restaurant_view_menu",
      title: t(ctx.locale, "restaurant.menu.view_title"),
      description: t(ctx.locale, "restaurant.menu.view_desc"),
    },
    {
      id: IDS.RESTAURANT_EDIT_MENU,
      title: t(ctx.locale, "restaurant.menu.edit_title") ?? "Edit menu",
      description: t(ctx.locale, "restaurant.menu.edit_desc") ?? "Add, rename, price, toggle, delete",
    },
    {
      id: "restaurant_upload_menu",
      title: t(ctx.locale, "restaurant.menu.upload_title"),
      description: t(ctx.locale, "restaurant.menu.upload_desc"),
    },
    {
      id: "restaurant_view_orders",
      title: t(ctx.locale, "restaurant.orders.view_title"),
      description: t(ctx.locale, "restaurant.orders.view_desc"),
    },
    {
      id: IDS.BACK_MENU,
      title: t(ctx.locale, "common.menu_back"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "restaurant.manager.title"),
      body: t(ctx.locale, "restaurant.manager.body"),
      sectionTitle: t(ctx.locale, "restaurant.manager.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🍽️" },
  );

  return true;
}

// Handle restaurant manager menu selection
export async function handleRestaurantManagerAction(
  ctx: RouterContext,
  state: RestaurantManagerState,
  actionId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.barId) return false;

  switch (actionId) {
    case "restaurant_view_menu":
      return await showCurrentMenu(ctx, state);
    case IDS.RESTAURANT_EDIT_MENU:
      return await startMenuEditor(ctx, state);
    case "restaurant_upload_menu":
      return await promptMenuUpload(ctx, state);
    case "restaurant_view_orders":
      return await showOrders(ctx, state);
    default:
      return false;
  }
}

// Show current menu
async function showCurrentMenu(
  ctx: RouterContext,
  state: RestaurantManagerState,
): Promise<boolean> {
  if (!state.barId) return false;

  // Try new schema (category_name) first, then fallback to legacy category
  let menuItems: Array<{ id: string; name: string; category?: string | null; price: number; currency: string; is_available: boolean }>|null = null;
  try {
    const { data, error } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("id, name, category_name, price, currency, is_available")
      .eq("bar_id", state.barId)
      .eq("is_available", true)
      .order("category_name", { ascending: true, nullsFirst: true })
      .order("name");
    if (error) throw error;
    menuItems = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category_name ?? undefined,
      price: row.price,
      currency: row.currency,
      is_available: row.is_available,
    }));
  } catch (err) {
    const { data, error: err2 } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("id, name, category, price, currency, is_available")
      .eq("bar_id", state.barId)
      .eq("is_available", true)
      .order("category")
      .order("name");
    if (err2) {
      console.error("restaurant.menu_fetch_fail", err2);
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "restaurant.menu.fetch_error"),
        homeOnly(),
      );
      return true;
    }
    menuItems = data as any;
  }

  if (!menuItems || menuItems.length === 0) {
    // Try showing the shared Rwanda catalog as a helpful preview
    const { data: shared } = await ctx.supabase
      .from("menu_items")
      .select("name, description, price, currency, category_name, category")
      .or("metadata->>source.eq.mirror,metadata->>from.eq.restaurant_menu_items")
      .eq("is_available", true)
      .order("category_name", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true })
      .limit(50);

    if (!shared || shared.length === 0) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "restaurant.menu.empty"),
        buildButtons(
          { id: "restaurant_upload_menu", title: t(ctx.locale, "restaurant.menu.upload_button") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }

    const byCat: Record<string, typeof shared> = {};
    for (const it of shared) {
      const cat = (it as any).category_name || (it as any).category || "Other";
      if (!byCat[cat]) byCat[cat] = [] as any;
      byCat[cat].push(it as any);
    }
    let preview = "No active menu configured. Here is the standard Rwanda menu preview:" + "\n\n";
    const cats = Object.keys(byCat).slice(0, 5);
    for (const cat of cats) {
      preview += `*${cat}*\n`;
      for (const it of byCat[cat].slice(0, 4)) {
        preview += `• ${it.name} - ${it.price} ${it.currency || 'RWF'}\n`;
      }
      preview += "\n";
    }

    await sendButtonsMessage(
      ctx,
      preview.trim(),
      buildButtons(
        { id: "restaurant_upload_menu", title: t(ctx.locale, "restaurant.menu.upload_button") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ),
    );
    return true;
  }

  // Group by category
  const byCategory: Record<string, typeof menuItems> = {};
  for (const item of menuItems) {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  // Build message
  let message = t(ctx.locale, "restaurant.menu.list_header") + "\n\n";
  for (const [category, items] of Object.entries(byCategory)) {
    message += `*${category}*\n`;
    for (const item of items) {
      message +=
        `• ${item.name} - ${item.price} ${item.currency}${item.is_available ? "" : " (unavailable)"}\n`;
    }
    message += "\n";
  }

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons(
      {
        id: "restaurant_upload_menu",
        title: t(ctx.locale, "restaurant.menu.update_button"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  await logStructuredEvent("RESTAURANT_MENU_VIEWED", {
    bar_id: state.barId,
    item_count: menuItems.length,
  });

  return true;
}

// Menu editor entry
async function startMenuEditor(ctx: RouterContext, state: RestaurantManagerState): Promise<boolean> {
  if (!state.barId) return false;
  await setState(ctx.supabase, ctx.profileId!, { key: "restaurant_edit", data: { barId: state.barId } });
  await sendListMessage(
    ctx,
    {
      title: "Menu editor",
      body: "Choose an action",
      sectionTitle: "Actions",
      rows: [
        { id: IDS.RESTAURANT_ADD_ITEM, title: "Add item", description: "Name | Category | Price | Currency" },
        { id: IDS.RESTAURANT_RENAME_ITEM, title: "Rename item", description: "Pick an item to rename" },
        { id: IDS.RESTAURANT_CHANGE_PRICE, title: "Change price", description: "Pick an item to price" },
        { id: IDS.RESTAURANT_TOGGLE_ITEM, title: "Toggle availability", description: "Enable/disable item" },
        { id: IDS.RESTAURANT_DELETE_ITEM, title: "Delete item", description: "Soft delete (unavailable)" },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ],
      buttonText: "Choose",
    },
    { emoji: "📝" },
  );
  return true;
}

// Helpers for item list selection
async function listMenuItems(
  ctx: RouterContext,
  barId: string,
  mapId: (id: string) => string,
  title = "Pick an item",
): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("id, name, category_name, price, currency, is_available")
    .eq("bar_id", barId)
    .order("category_name", { ascending: true, nullsFirst: true })
    .order("name")
    .limit(30);
  if (error) {
    console.error("restaurant.items_list_fail", error);
    await sendButtonsMessage(ctx, "⚠️ Failed to load items.", homeOnly());
    return true;
  }
  const rows = (data ?? []).map((it: any) => ({
    id: mapId(it.id),
    title: `${it.name} • ${it.price} ${it.currency}`,
    description: it.category_name ? `${it.category_name}${it.is_available ? '' : ' • unavailable'}` : (it.is_available ? '' : 'unavailable'),
  }));
  rows.push({ id: IDS.RESTAURANT_EDIT_MENU, title: "← Back", description: "Return to editor" });
  await sendListMessage(
    ctx,
    { title, body: "", sectionTitle: "Items", rows, buttonText: "Select" },
  );
  return true;
}

export async function handleRestaurantEditAction(
  ctx: RouterContext,
  state: { barId?: string; action?: string; itemId?: string; stage?: string },
  actionId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.barId) return false;
  const setEditState = async (patch: Record<string, unknown>) =>
    await setState(ctx.supabase, ctx.profileId!, { key: "restaurant_edit", data: { ...state, ...patch } });

  if (actionId === IDS.RESTAURANT_ADD_ITEM) {
    await setEditState({ stage: "awaiting_add" });
    await sendButtonsMessage(
      ctx,
      "Send: Name | Category | Price | Currency (e.g., Brochette | Grill | 2500 | RWF)",
      homeOnly(),
    );
    return true;
  }
  if (actionId === IDS.RESTAURANT_RENAME_ITEM) {
    return await listMenuItems(ctx, state.barId, (id) => `re_rename::${id}`, "Pick item to rename");
  }
  if (actionId === IDS.RESTAURANT_CHANGE_PRICE) {
    return await listMenuItems(ctx, state.barId, (id) => `re_price::${id}`, "Pick item to reprice");
  }
  if (actionId === IDS.RESTAURANT_TOGGLE_ITEM) {
    return await listMenuItems(ctx, state.barId, (id) => `re_toggle::${id}`, "Pick item to toggle");
  }
  if (actionId === IDS.RESTAURANT_DELETE_ITEM) {
    return await listMenuItems(ctx, state.barId, (id) => `re_delete::${id}`, "Pick item to delete");
  }

  // Selection handlers
  if (actionId.startsWith("re_rename::")) {
    const itemId = actionId.slice("re_rename::".length);
    await setEditState({ stage: "awaiting_rename", itemId });
    await sendButtonsMessage(ctx, "Send the new name", homeOnly());
    return true;
  }
  if (actionId.startsWith("re_price::")) {
    const itemId = actionId.slice("re_price::".length);
    await setEditState({ stage: "awaiting_price", itemId });
    await sendButtonsMessage(ctx, "Send the new price (e.g., 2500 or 2500 RWF)", homeOnly());
    return true;
  }
  if (actionId.startsWith("re_toggle::")) {
    const itemId = actionId.slice("re_toggle::".length);
    const { data } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("is_available")
      .eq("id", itemId)
      .maybeSingle();
    const is_available = !(data?.is_available ?? true);
    await ctx.supabase
      .from("restaurant_menu_items")
      .update({ is_available })
      .eq("id", itemId);
    await sendButtonsMessage(ctx, is_available ? "✅ Item enabled" : "✅ Item disabled", homeOnly());
    return true;
  }
  if (actionId.startsWith("re_delete::")) {
    const itemId = actionId.slice("re_delete::".length);
    await ctx.supabase
      .from("restaurant_menu_items")
      .update({ is_available: false })
      .eq("id", itemId);
    await sendButtonsMessage(ctx, "🗑️ Item deleted (soft)", homeOnly());
    return true;
  }

  return false;
}

export async function handleRestaurantEditText(
  ctx: RouterContext,
  body: string,
  state: { barId?: string; stage?: string; itemId?: string },
): Promise<boolean> {
  if (!ctx.profileId || !state.barId) return false;
  const items = ctx.supabase.from("restaurant_menu_items");
  const finish = async (message: string) => {
    await sendButtonsMessage(ctx, message, homeOnly());
    await setState(ctx.supabase, ctx.profileId!, { key: "restaurant_edit", data: { barId: state.barId } });
  };
  try {
    if (state.stage === "awaiting_add") {
      const parts = body.split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length < 3) {
        await sendButtonsMessage(ctx, "Format: Name | Category | Price | Currency", homeOnly());
        return true;
      }
      const [name, category_name, priceRaw, currencyRaw] = [parts[0], parts[1], parts[2], parts[3] ?? "RWF"];
      const price = Number(String(priceRaw).replace(/[^0-9.]/g, ""));
      const currency = String(currencyRaw || "RWF").toUpperCase().slice(0, 5);
      if (!name || !category_name || !Number.isFinite(price)) {
        await sendButtonsMessage(ctx, "Invalid values. Example: Brochette | Grill | 2500 | RWF", homeOnly());
        return true;
      }
      const { error } = await items.insert({ bar_id: state.barId, name, category_name, price, currency, is_available: true });
      if (error) throw error;
      await finish(`✅ Added: ${name} - ${price} ${currency}`);
      return true;
    }
    if (state.stage === "awaiting_rename" && state.itemId) {
      const name = body.trim().slice(0, 120);
      const { error } = await items.update({ name }).eq("id", state.itemId);
      if (error) throw error;
      await finish("✅ Renamed.");
      return true;
    }
    if (state.stage === "awaiting_price" && state.itemId) {
      const match = body.trim().match(/([0-9][0-9.,]*)\s*([A-Za-z]{3,5})?/);
      if (!match) {
        await sendButtonsMessage(ctx, "Format: 2500 or 2500 RWF", homeOnly());
        return true;
      }
      const price = Number(match[1].replace(/[^0-9.]/g, ""));
      const currency = (match[2] ?? "RWF").toUpperCase().slice(0, 5);
      const { error } = await items.update({ price, currency }).eq("id", state.itemId);
      if (error) throw error;
      await finish(`✅ Price updated: ${price} ${currency}`);
      return true;
    }
  } catch (err) {
    console.error("restaurant.edit_text_fail", err);
    await sendButtonsMessage(ctx, "⚠️ Failed to update.", homeOnly());
    return true;
  }
  return false;
}

// Prompt for menu upload
async function promptMenuUpload(
  ctx: RouterContext,
  state: RestaurantManagerState,
): Promise<boolean> {
  if (!ctx.profileId || !state.barId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "restaurant_upload",
    data: { barId: state.barId },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "restaurant.menu.upload_prompt"),
    buildButtons(
      {
        id: "restaurant_contact_support",
        title: t(ctx.locale, "restaurant.menu.contact_support"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  return true;
}

// Handle menu file upload
export async function handleMenuFileUpload(
  ctx: RouterContext,
  state: RestaurantManagerState,
  fileUrl: string,
  fileType: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.barId) return false;

  // Create upload request
  const { data: uploadRequest, error } = await ctx.supabase
    .from("menu_upload_requests")
    .insert({
      bar_id: state.barId,
      uploaded_by: ctx.from,
      file_url: fileUrl,
      file_type: fileType,
      status: "pending",
    })
    .select()
    .single();

  if (error || !uploadRequest) {
    console.error("restaurant.upload_create_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "restaurant.menu.upload_error"),
      homeOnly(),
    );
    return true;
  }

  await logStructuredEvent("RESTAURANT_MENU_UPLOADED", {
    bar_id: state.barId,
    upload_id: uploadRequest.id,
    file_type: fileType,
  });

  // Trigger OCR processing asynchronously
  try {
    await ctx.supabase.functions.invoke("ocr-processor", {
      body: { uploadRequestId: uploadRequest.id },
    });
  } catch (err) {
    console.error("restaurant.ocr_trigger_fail", err);
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "restaurant.menu.upload_processing"),
    homeOnly(),
  );

  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

// Show orders (placeholder for now)
async function showOrders(
  ctx: RouterContext,
  state: RestaurantManagerState,
): Promise<boolean> {
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "restaurant.orders.coming_soon"),
    homeOnly(),
  );
  return true;
}
