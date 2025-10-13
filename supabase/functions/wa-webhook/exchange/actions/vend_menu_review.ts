import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { promoteDraftToPublished } from "../helpers.ts";

export async function handleVendorMenuReview(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_open_items":
      return await openItems(req);
    case "a_load_categories":
      return await loadCategories(req);
    case "a_cat_move":
      return await reorderCategory(
        req,
        req.fields?.direction === "up" ? -1 : 1,
      );
    case "a_cat_rename":
      return await renameCategory(req);
    case "a_cat_add":
      return await addSubcategory(req);
    case "a_item_toggle":
      return await toggleItem(req);
    case "a_item_edit_open":
      return await openItem(req);
    case "a_item_save":
      return await saveItem(req);
    case "a_item_create":
      return await createItem(req);
    case "a_bulk_prices":
      return await bulkEditPrices(req);
    case "a_publish_now":
      return await publish(req);
    default:
      return notHandled(req);
  }
}

function notHandled(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{
      level: "warning",
      text: `Action ${req.action_id} under construction.`,
    }],
  };
}

async function openItems(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const categoryId = String(req.fields?.category_id ?? "");
  if (!categoryId) return notHandled(req);
  const category = await supabase
    .from("categories")
    .select("id, bar_id, name")
    .eq("id", categoryId)
    .maybeSingle();
  if (category.error || !category.data) return notHandled(req);
  const { data, error } = await supabase
    .from("items")
    .select("id, name, is_available, price_minor, currency")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load items" }],
    };
  }
  return {
    next_screen_id: "s_items_list",
    data: {
      bar_id: category.data.bar_id,
      category_id: categoryId,
      category_name: category.data.name,
      items: (data ?? []).map((item) => ({
        id: item.id,
        title: `${item.name} — ${
          (item.price_minor ?? 0) / 100
        } ${(item.currency ?? "RWF")}`,
        description: item.is_available ? "Available" : "Unavailable",
      })),
    },
  };
}

async function loadCategories(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(
    req.context?.bar_id ?? req.fields?.bar_id ?? req.filters?.bar_id ?? "",
  );
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar context" }],
    };
  }
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id, status")
    .eq("bar_id", barId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (menuError || !menu) {
    return {
      next_screen_id: "s_categories",
      data: {
        bar_id: barId,
        categories: [],
        menu_status: "missing",
      },
      messages: [{
        level: "warning",
        text: "No menu yet. Upload a menu in onboarding first.",
      }],
    };
  }
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("menu_id", menu.id)
    .is("parent_category_id", null)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load categories." }],
    };
  }
  return {
    next_screen_id: "s_categories",
    data: {
      bar_id: barId,
      menu_id: menu.id,
      menu_status: menu.status,
      categories: (categories ?? []).map((cat) => ({
        id: cat.id,
        title: cat.name,
        description: `Position ${cat.sort_order}`,
      })),
    },
  };
}

async function reorderCategory(
  req: FlowExchangeRequest,
  delta: number,
): Promise<FlowExchangeResponse> {
  const categoryId = String(req.fields?.category_id ?? "");
  if (!categoryId) return notHandled(req);
  const { data, error } = await supabase
    .from("categories")
    .select("id, sort_order")
    .eq("id", categoryId)
    .maybeSingle();
  if (error || !data) return notHandled(req);
  await supabase
    .from("categories")
    .update({ sort_order: data.sort_order + delta })
    .eq("id", categoryId);
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Category reordered." }],
  };
}

async function renameCategory(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const categoryId = String(req.fields?.category_id ?? "");
  const newName = String(req.fields?.new_name ?? "").trim();
  if (!categoryId || !newName) return notHandled(req);
  await supabase
    .from("categories")
    .update({ name: newName })
    .eq("id", categoryId);
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Category renamed." }],
  };
}

async function addSubcategory(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const parentId = String(req.fields?.parent_category_id ?? "");
  const name = String(req.fields?.name ?? "").trim();
  if (!parentId || !name) return notHandled(req);
  const parent = await supabase
    .from("categories")
    .select("bar_id, menu_id")
    .eq("id", parentId)
    .maybeSingle();
  if (parent.error || !parent.data) return notHandled(req);
  await supabase
    .from("categories")
    .insert({
      bar_id: parent.data.bar_id,
      menu_id: parent.data.menu_id,
      parent_category_id: parentId,
      name,
      sort_order: 100,
    });
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Subcategory added." }],
  };
}

async function toggleItem(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const itemId = String(req.fields?.item_id ?? "");
  if (!itemId) return notHandled(req);
  const { data, error } = await supabase
    .from("items")
    .select("is_available")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return notHandled(req);
  await supabase
    .from("items")
    .update({ is_available: !data.is_available })
    .eq("id", itemId);
  return {
    next_screen_id: req.screen_id,
    messages: [{
      level: "info",
      text: `Item ${data.is_available ? "hidden" : "available"}.`,
    }],
  };
}

async function openItem(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const itemId = String(req.fields?.item_id ?? "");
  if (!itemId) return notHandled(req);
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, name, short_description, price_minor, currency, flags, is_available",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return notHandled(req);
  return {
    next_screen_id: "s_item_edit",
    data: {
      item_id: data.id,
      name: data.name,
      short_desc: data.short_description ?? "",
      price: (data.price_minor ?? 0) / 100,
      flags_selected: data.flags ?? [],
      available: data.is_available,
    },
  };
}

async function saveItem(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const itemId = String(req.fields?.item_id ?? "");
  const name = String(req.fields?.name ?? "").trim();
  const price = parseFloat(String(req.fields?.price ?? "0")) || 0;
  if (!itemId || !name) return notHandled(req);
  const { error } = await supabase
    .from("items")
    .update({
      name,
      short_description: String(req.fields?.short_desc ?? ""),
      price_minor: Math.round(price * 100),
      flags: req.fields?.flags ?? [],
      is_available: String(req.fields?.available ?? "true") === "true",
    })
    .eq("id", itemId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to save item" }],
    };
  }
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Item saved." }],
  };
}

async function createItem(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const categoryId = String(req.fields?.category_id ?? "");
  const name = String(req.fields?.name ?? "").trim();
  const price = parseFloat(String(req.fields?.price ?? "0")) || 0;
  if (!categoryId || !name) return notHandled(req);
  const category = await supabase
    .from("categories")
    .select("bar_id, menu_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (category.error || !category.data) return notHandled(req);
  await supabase
    .from("items")
    .insert({
      bar_id: category.data.bar_id,
      menu_id: category.data.menu_id,
      category_id: categoryId,
      name,
      short_description: String(req.fields?.short_desc ?? ""),
      price_minor: Math.round(price * 100),
      flags: req.fields?.flags ?? [],
    });
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Item created." }],
  };
}

async function bulkEditPrices(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const categoryId = String(req.fields?.category_id ?? "");
  const mode = String(req.fields?.mode ?? "increase");
  const amountType = String(req.fields?.amount_type ?? "currency");
  const amountValue = parseFloat(String(req.fields?.amount_value ?? "0")) || 0;
  if (!categoryId || !amountValue) return notHandled(req);
  const { data, error } = await supabase
    .from("items")
    .select("id, price_minor")
    .eq("category_id", categoryId);
  if (error) return notHandled(req);
  for (const item of data ?? []) {
    let price = item.price_minor ?? 0;
    if (mode === "increase") {
      price += amountType === "currency"
        ? Math.round(amountValue * 100)
        : Math.round(price * (amountValue / 100));
    } else if (mode === "decrease") {
      price -= amountType === "currency"
        ? Math.round(amountValue * 100)
        : Math.round(price * (amountValue / 100));
    } else if (mode === "set_exact") {
      price = Math.round(amountValue * 100);
    }
    if (price < 0) price = 0;
    await supabase
      .from("items")
      .update({ price_minor: price })
      .eq("id", item.id);
  }
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Prices updated." }],
  };
}

async function publish(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? req.context?.bar_id ?? "");
  if (!barId) return notHandled(req);
  try {
    const publishedMenuId = await promoteDraftToPublished({ barId });
    const { data: publishedMeta } = await supabase
      .from("menus")
      .select("version")
      .eq("id", publishedMenuId)
      .maybeSingle();
    await supabase
      .from("bars")
      .update({ is_active: true })
      .eq("id", barId);
    const versionText = publishedMeta?.version
      ? `Version ${publishedMeta.version}`
      : "Menu";
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "info", text: `${versionText} published.` }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: `Publish failed: ${message}` }],
    };
  }
}
