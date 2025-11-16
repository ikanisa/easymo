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
): Promise<{ isManager: boolean; barId?: string }> {
  if (!ctx.profileId) return { isManager: false };

  const { data, error } = await ctx.supabase
    .from("bar_managers")
    .select("bar_id, is_active")
    .eq("user_id", ctx.profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return { isManager: false };
  }

  return { isManager: true, barId: data.bar_id };
}

// Start restaurant manager menu
export async function startRestaurantManager(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { isManager, barId } = await isBarManager(ctx);

  if (!isManager) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "restaurant.not_manager"),
      homeOnly(),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "restaurant_manager",
    data: { barId },
  });

  const rows = [
    {
      id: "restaurant_view_menu",
      title: t(ctx.locale, "restaurant.menu.view_title"),
      description: t(ctx.locale, "restaurant.menu.view_desc"),
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
