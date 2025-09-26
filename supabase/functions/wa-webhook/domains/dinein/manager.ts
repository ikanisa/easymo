import type { RouterContext } from "../../types.ts";
import { sendButtons, sendList } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { DINE_IDS, makeOrderRowId, makeReviewItemRowId } from "./ids.ts";
import { DINE_STATE, setDineState } from "./state.ts";
import { listBusinessCategories, matchBusinessCategory } from "./categories.ts";
import { fmtCurrency, truncate } from "../../utils/text.ts";

const ENTRY_EMOJI = "🍽️";
const MANAGER_EMOJI = "🛠️";
const FORM_EMOJI = "📝";
const INFO_EMOJI = "ℹ️";
const WARNING_EMOJI = "⚠️";

type ManagerContext = {
  barId?: string | null;
  barName?: string | null;
  barSlug?: string | null;
};

type TopBarItem = {
  item_id: string;
  item_name: string;
  short_description: string | null;
  price_minor: number;
  currency: string | null;
  category_name: string | null;
  is_available: boolean;
  total_qty: number;
  last_order: string | null;
};

type RecentBarOrder = {
  order_id: string;
  order_code: string;
  created_at: string | null;
  items: string | null;
};

type ItemDetail = {
  id: string;
  name: string;
  short_description: string | null;
  price_minor: number;
  currency: string | null;
  category_name: string | null;
  is_available: boolean;
};

function extractManagerContext(
  state?: { data?: Record<string, unknown> },
): ManagerContext {
  const data = state?.data ?? {};
  const barId = typeof data.barId === "string"
    ? data.barId
    : typeof data.bar_id === "string"
    ? data.bar_id
    : null;
  const barName = typeof data.barName === "string"
    ? data.barName
    : typeof data.bar_name === "string"
    ? data.bar_name
    : null;
  const barSlug = typeof data.barSlug === "string"
    ? data.barSlug
    : typeof data.bar_slug === "string"
    ? data.bar_slug
    : null;
  return { barId, barName, barSlug };
}

export function managerContextFromState(
  state?: { data?: Record<string, unknown> },
): ManagerContext {
  return extractManagerContext(state);
}

function contextData(
  context: ManagerContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...extra };
  if (context.barId) {
    data.barId = context.barId;
    data.bar_id = context.barId;
  }
  if (context.barName) {
    data.barName = context.barName;
    data.bar_name = context.barName;
  }
  if (context.barSlug) {
    data.barSlug = context.barSlug;
    data.bar_slug = context.barSlug;
  }
  return data;
}

async function ensureBarContext(
  ctx: RouterContext,
  context: ManagerContext,
  message: string,
): Promise<ManagerContext | null> {
  if (context.barId) return context;
  await sendButtons(ctx.from, `${WARNING_EMOJI} ${message}`, [{
    id: IDS.DINEIN_BARS_VIEW,
    title: "Find a bar",
  }]);
  return null;
}

export async function showBarsEntry(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ENTRY, {
    back: null,
    data: contextData(context),
  });
  await sendButtons(ctx.from, `${ENTRY_EMOJI} Bars & restaurants`, [{
    id: IDS.DINEIN_BARS_VIEW,
    title: "View",
  }]);
}

export async function showBarsMenu(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.MENU, {
    back: DINE_STATE.ENTRY,
    data: contextData(context),
  });
  await sendList(ctx.from, {
    title: "Bars & restaurants",
    body: "Pick an option.",
    sectionTitle: "Explore",
    buttonText: "View",
    rows: [
      { id: IDS.DINEIN_BARS_VIEW_LIST, title: "View bars & restaurants" },
      { id: IDS.DINEIN_BARS_MANAGE, title: "Manage bars" },
      { id: IDS.BACK_MENU, title: "← Back" },
    ],
  });
}

export async function showManagerEntry(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.MANAGER_ENTRY, {
    back: DINE_STATE.MENU,
    data: contextData(context),
  });
  await sendButtons(ctx.from, `${MANAGER_EMOJI} Bar manager`, [{
    id: IDS.DINEIN_BARS_MANAGER_VIEW,
    title: "View",
  }]);
}

export async function showManagerMenu(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.MANAGER_MENU, {
    back: DINE_STATE.MANAGER_ENTRY,
    data: contextData(context),
  });
  const bodyLines = ["Choose what to do next."];
  if (context.barName) {
    bodyLines.push(`Managing: ${context.barName}`);
  } else {
    bodyLines.push(
      "Select a bar first via View bars & restaurants for context.",
    );
  }
  await sendList(ctx.from, {
    title: "Bar manager",
    body: bodyLines.join("\n"),
    sectionTitle: "Manage",
    buttonText: "View",
    rows: [
      { id: IDS.DINEIN_BARS_ONBOARD, title: "Onboard bar" },
      { id: IDS.DINEIN_BARS_UPLOAD, title: "Upload/Update menu" },
      { id: IDS.DINEIN_BARS_REVIEW, title: "Review & edit menu" },
      { id: IDS.DINEIN_BARS_MANAGE_ORDERS, title: "Manage orders" },
      { id: IDS.DINEIN_BARS_ADD_WHATSAPP, title: "Add WhatsApp numbers" },
      { id: IDS.BACK_MENU, title: "← Back" },
    ],
  });
}

export async function showOnboardIdentity(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ONBOARD_IDENTITY, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, {
      name: null,
      location: null,
      category: null,
      categorySlug: null,
    }),
  });
  const categories = await listBusinessCategories(ctx);
  const hints = categories.length
    ? `Categories: ${categories.slice(0, 5).map((cat) => cat.label).join(", ")}`
    : "Category optional";
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Onboard bar — identity\n• Send bar name\n• Send location\n• Optional: category\n${hints}`,
    [{
      id: IDS.DINEIN_BARS_ONBOARD_CONTINUE,
      title: "Continue",
    }],
  );
}

export async function showOnboardContacts(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ONBOARD_CONTACTS, {
    back: DINE_STATE.ONBOARD_IDENTITY,
    data: contextData(context, { whatsapp: [], momo: null }),
  });
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Contacts & payment\n• Reply with WhatsApp numbers (comma separated)\n• Reply with MoMo pay code`,
    [{
      id: IDS.DINEIN_BARS_ONBOARD_CONTACTS_CONTINUE,
      title: "Continue",
    }],
  );
}

export async function showOnboardUpload(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ONBOARD_UPLOAD, {
    back: DINE_STATE.ONBOARD_CONTACTS,
    data: contextData(context, { mode: "onboard" }),
  });
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Upload menu\nSend PDF or clear images in this chat.`,
    [{
      id: IDS.DINEIN_BARS_ONBOARD_UPLOAD_DONE,
      title: "I uploaded",
    }],
  );
}

export async function showOnboardPublish(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ONBOARD_PUBLISH, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  await sendButtons(
    ctx.from,
    `${MANAGER_EMOJI} Review & publish\nConfirm details and publish when ready.`,
    [{
      id: IDS.DINEIN_BARS_ONBOARD_PUBLISH,
      title: "Publish",
    }],
  );
}

export async function showUploadInstruction(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ONBOARD_UPLOAD, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { mode: "update" }),
  });
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Upload/Update menu\nSend PDFs or clear photos now. We'll notify once OCR finishes.`,
    [{
      id: IDS.DINEIN_BARS_ONBOARD_UPLOAD_DONE,
      title: "Done",
    }],
  );
}

export async function showManageOrders(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(
    ctx,
    context,
    "Select a bar first via View bars & restaurants before viewing orders.",
  );
  await setDineState(ctx, DINE_STATE.MANAGE_ORDERS, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  if (!ensured) return;
  const orders = await fetchRecentOrders(ctx, ensured.barId!);
  if (!orders.length) {
    await sendButtons(ctx.from, `${INFO_EMOJI} No recent orders yet.`, [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back to manager",
    }]);
    return;
  }
  await setDineState(ctx, DINE_STATE.MANAGE_ORDERS, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(ensured, { orders }),
  });
  const rows = orders.map((order) => ({
    id: makeOrderRowId(order.order_id),
    title: `#${order.order_code}`,
    description: formatOrderDescription(order),
  }));
  rows.push({ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: "← Back" });
  await sendList(ctx.from, {
    title: ensured.barName ? `${ensured.barName} orders` : "Recent orders",
    body: "View-only queue.",
    sectionTitle: "Orders",
    buttonText: "View",
    rows,
  });
}

export async function showAddWhatsappPrompt(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.ADD_WHATSAPP, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { numbers: [] }),
  });
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Add WhatsApp numbers\nReply with phone numbers in E.164 format (comma separated).`,
    [{
      id: IDS.DINEIN_BARS_ADD_WHATSAPP,
      title: "Save",
    }],
  );
}

export async function showReviewIntro(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(
    ctx,
    context,
    "Select a bar first via View bars & restaurants before reviewing menu items.",
  );
  await setDineState(ctx, DINE_STATE.REVIEW_LIST, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  if (!ensured) return;
  await showReviewList(ctx, ensured);
}

export async function showReviewList(
  ctx: RouterContext,
  context: ManagerContext,
): Promise<void> {
  const items = await fetchTopBarItems(ctx, context.barId!);
  if (!items.length) {
    await sendButtons(ctx.from, `${INFO_EMOJI} No menu items published yet.`, [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back to manager",
    }]);
    return;
  }
  await setDineState(ctx, DINE_STATE.REVIEW_LIST, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { items }),
  });
  const rows = items.map((item) => ({
    id: makeReviewItemRowId(item.item_id),
    title: formatItemTitle(item),
    description: formatItemDescription(item),
  }));
  rows.push({ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: "← Back" });
  await sendList(ctx.from, {
    title: context.barName ? `${context.barName} menu` : "Menu items",
    body: "Top items by demand.",
    sectionTitle: "Items",
    buttonText: "View",
    rows,
  });
}

export async function showReviewItemMenu(
  ctx: RouterContext,
  context: ManagerContext,
  itemId: string,
  state?: { data?: Record<string, unknown> },
): Promise<void> {
  const cachedItems = Array.isArray(state?.data?.items)
    ? state?.data?.items as TopBarItem[]
    : [];
  const cached = cachedItems.find((item) => item.item_id === itemId);
  const detail = cached ?? await fetchItemDetail(ctx, itemId);
  if (!detail) {
    await sendButtons(ctx.from, `${WARNING_EMOJI} Item not found.`, [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: "Back",
    }]);
    return;
  }
  await setDineState(ctx, DINE_STATE.REVIEW_ITEM_MENU, {
    back: DINE_STATE.REVIEW_LIST,
    data: contextData(context, {
      itemId,
      itemName: detail.item_name ?? detail.name,
      itemPriceMinor: detail.price_minor,
      itemCurrency: detail.currency,
      itemCategory: detail.category_name,
      itemAvailable: detail.is_available,
    }),
  });
  await sendList(ctx.from, {
    title: detail.item_name ?? detail.name,
    body: formatItemDescription(detail),
    sectionTitle: "Actions",
    buttonText: "View",
    rows: [
      { id: IDS.DINEIN_BARS_REVIEW_EDIT, title: "Edit item" },
      {
        id: IDS.DINEIN_BARS_REVIEW_TOGGLE,
        title: detail.is_available ? "Mark unavailable" : "Mark available",
      },
      { id: IDS.DINEIN_BARS_REVIEW, title: "← Back" },
    ],
  });
}

export async function showReviewEditOptions(
  ctx: RouterContext,
  context: ManagerContext,
  itemState: { itemId: string; itemName: string },
): Promise<void> {
  await setDineState(ctx, DINE_STATE.REVIEW_ITEM_MENU, {
    back: DINE_STATE.REVIEW_LIST,
    data: contextData(context, {
      ...itemState,
    }),
  });
  await sendList(ctx.from, {
    title: `Edit ${itemState.itemName}`,
    body: "What do you want to update?",
    sectionTitle: "Fields",
    buttonText: "View",
    rows: [
      { id: IDS.DINEIN_BARS_REVIEW_EDIT_NAME, title: "Edit name" },
      { id: IDS.DINEIN_BARS_REVIEW_EDIT_PRICE, title: "Edit price" },
      {
        id: IDS.DINEIN_BARS_REVIEW_EDIT_DESCRIPTION,
        title: "Edit description",
      },
      { id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU, title: "← Back" },
    ],
  });
}

export async function promptReviewEditField(
  ctx: RouterContext,
  context: ManagerContext,
  itemId: string,
  itemName: string,
  field: "name" | "price" | "description",
): Promise<void> {
  await setDineState(ctx, DINE_STATE.REVIEW_EDIT_FIELD, {
    back: DINE_STATE.REVIEW_ITEM_MENU,
    data: contextData(context, {
      itemId,
      itemName,
      field,
    }),
  });
  const prompt = field === "name"
    ? "Send the new item name."
    : field === "price"
    ? "Send the new price (numbers only, optional currency)."
    : "Send the new description.";
  await sendButtons(ctx.from, `${FORM_EMOJI} ${prompt}`, [{
    id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
    title: "Cancel",
  }]);
}

export async function handleReviewEditText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.REVIEW_EDIT_FIELD) return false;
  const data = state.data ?? {};
  const itemId = typeof data.itemId === "string" ? data.itemId : null;
  const field = data.field === "name" || data.field === "price" ||
      data.field === "description"
    ? data.field
    : null;
  if (!itemId || !field) return false;
  const context = extractManagerContext(state);
  try {
    if (field === "name") {
      const value = body.trim();
      if (!value) throw new Error("Name required");
      await ctx.supabase.from("items").update({ name: value }).eq("id", itemId);
      await sendButtons(
        ctx.from,
        `${MANAGER_EMOJI} Name updated to “${value}”.`,
        [{
          id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
          title: "View item",
        }],
      );
      return true;
    }
    if (field === "price") {
      const valueMinor = parsePriceToMinor(body);
      if (valueMinor <= 0) throw new Error("Enter a valid price");
      await ctx.supabase.from("items").update({ price_minor: valueMinor }).eq(
        "id",
        itemId,
      );
      await sendButtons(ctx.from, `${MANAGER_EMOJI} Price updated.`, [{
        id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
        title: "View item",
      }]);
      return true;
    }
    const description = body.trim();
    await ctx.supabase.from("items").update({
      short_description: description || null,
    }).eq("id", itemId);
    await sendButtons(ctx.from, `${MANAGER_EMOJI} Description updated.`, [{
      id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
      title: "View item",
    }]);
    return true;
  } catch (error) {
    console.error("dine.review.edit_fail", error);
    await sendButtons(ctx.from, `${WARNING_EMOJI} Update failed. Try again.`, [{
      id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
      title: "Back",
    }]);
    return true;
  } finally {
    await ctx.supabase.rpc("refresh_menu_items_snapshot");
  }
}

export async function handleToggleAvailability(
  ctx: RouterContext,
  context: ManagerContext,
  itemId: string,
  currentStatus: boolean,
  itemName: string,
): Promise<void> {
  try {
    await ctx.supabase.from("items").update({ is_available: !currentStatus })
      .eq(
        "id",
        itemId,
      );
    await ctx.supabase.rpc("refresh_menu_items_snapshot");
    await setDineState(ctx, DINE_STATE.REVIEW_ITEM_MENU, {
      back: DINE_STATE.REVIEW_LIST,
      data: contextData(context, {
        itemId,
        itemName,
        itemAvailable: !currentStatus,
      }),
    });
    const statusLabel = !currentStatus ? "available" : "unavailable";
    await sendButtons(
      ctx.from,
      `${MANAGER_EMOJI} Item marked ${statusLabel}.`,
      [{
        id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
        title: "View item",
      }],
    );
  } catch (error) {
    console.error("dine.review.toggle_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Failed to toggle availability.`,
      [{
        id: IDS.DINEIN_BARS_REVIEW_ITEM_MENU,
        title: "Back",
      }],
    );
  }
}

export async function handleOrderRowSelection(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
  orderId: string,
): Promise<void> {
  const orders = Array.isArray(state.data?.orders)
    ? state.data?.orders as RecentBarOrder[]
    : [];
  const match = orders.find((order) => order.order_id === orderId);
  if (!match) {
    await sendButtons(ctx.from, `${WARNING_EMOJI} Order not found.`, [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back",
    }]);
    return;
  }
  await sendButtons(
    ctx.from,
    `${INFO_EMOJI} #${match.order_code}\n${formatOrderDescription(match)}`,
    [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back to manager",
    }],
  );
}

export async function handleAddWhatsappText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ADD_WHATSAPP) return false;
  const numbers = parseContactsInput(body).whatsapp;
  const context = extractManagerContext(state);
  await setDineState(ctx, DINE_STATE.ADD_WHATSAPP, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { numbers }),
  });
  await sendButtons(
    ctx.from,
    `${FORM_EMOJI} Numbers captured\n${
      numbers.length ? numbers.join(", ") : "No valid numbers yet."
    }`,
    [{
      id: IDS.DINEIN_BARS_ADD_WHATSAPP,
      title: "Save",
    }],
  );
  return true;
}

export async function handleAddWhatsappSave(ctx: RouterContext): Promise<void> {
  await sendButtons(
    ctx.from,
    `${MANAGER_EMOJI} WhatsApp numbers queued for syncing.`,
    [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back to manager",
    }],
  );
}

export async function handleUploadDone(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const mode = state?.data?.mode === "update" ? "update" : "onboard";
  const message = mode === "update"
    ? `${MANAGER_EMOJI} Thanks! We'll process the new menu and let you know when it's ready.`
    : `${MANAGER_EMOJI} Menu received. We'll process OCR and prompt you to publish.`;
  await sendButtons(ctx.from, message, [{
    id: IDS.DINEIN_BARS_MANAGER_VIEW,
    title: "Back to manager",
  }]);
  await setDineState(ctx, DINE_STATE.MANAGER_MENU, {
    back: DINE_STATE.MANAGER_ENTRY,
    data: contextData(context),
  });
}

export async function handlePublish(ctx: RouterContext): Promise<void> {
  await sendButtons(
    ctx.from,
    `${MANAGER_EMOJI} Publish requested. We'll confirm once the menu is live.`,
    [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: "Back to manager",
    }],
  );
}

function parseIdentityInput(body: string): {
  name?: string;
  location?: string;
  category?: string;
} {
  const updates: { name?: string; location?: string; category?: string } = {};
  const parts = body.split(/\n|;/).map((value) => value.trim()).filter(Boolean);
  for (const part of parts) {
    const [labelPart, ...rest] = part.split(/[:=]/);
    if (!rest.length) continue;
    const label = labelPart.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) continue;
    if (label.startsWith("name")) updates.name = value;
    if (label.startsWith("location")) updates.location = value;
    if (label.startsWith("category")) updates.category = value;
  }
  if (!Object.keys(updates).length) {
    if (!updates.name) updates.name = body.trim();
  }
  return updates;
}

function parseContactsInput(body: string): {
  whatsapp: string[];
  momo?: string;
} {
  const whatsapp: string[] = [];
  let momo: string | undefined;
  const segments = body.split(/\n|;/).map((value) => value.trim()).filter(
    Boolean,
  );
  for (const segment of segments) {
    if (/momo/i.test(segment)) {
      const [, value] = segment.split(/[:=]/);
      if (value?.trim()) momo = value.trim();
      continue;
    }
    const numbers = segment.split(/[,\s]+/).map((value) => value.trim()).filter(
      Boolean,
    );
    for (const number of numbers) {
      if (/^\+?[0-9]{6,15}$/.test(number)) {
        whatsapp.push(number.startsWith("+") ? number : `+${number}`);
      }
    }
  }
  return { whatsapp, momo };
}

function parsePriceToMinor(input: string): number {
  const cleaned = input.replace(/[a-zA-Z,\s]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(".")) {
    const asNumber = Number(cleaned);
    return Number.isFinite(asNumber) ? Math.round(asNumber * 100) : 0;
  }
  const asInt = Number(cleaned);
  return Number.isFinite(asInt) ? Math.trunc(asInt) : 0;
}

function formatItemTitle(item: TopBarItem | ItemDetail): string {
  const name = "item_name" in item ? item.item_name : item.name;
  const status = item.is_available ? "✅" : "⛔";
  return `${status} ${truncate(name, 60)}`;
}

function formatItemDescription(item: TopBarItem | ItemDetail): string {
  const price = fmtCurrency(item.price_minor, item.currency ?? "RWF");
  const parts = [price];
  if (item.category_name) parts.push(truncate(item.category_name, 32));
  if (item.short_description) parts.push(truncate(item.short_description, 60));
  return parts.join(" • ");
}

function formatOrderDescription(order: RecentBarOrder): string {
  const when = order.created_at
    ? new Date(order.created_at).toLocaleString("en-GB", {
      hour12: false,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";
  const items = order.items ?? "No items";
  return [items, when].filter(Boolean).join(" • ");
}

async function fetchTopBarItems(
  ctx: RouterContext,
  barId: string,
): Promise<TopBarItem[]> {
  const { data, error } = await ctx.supabase.rpc("top_bar_items", {
    p_bar: barId,
    p_limit: 9,
  });
  if (error) {
    console.error("dine.top_items.fail", error);
    return [];
  }
  return (data ?? []) as TopBarItem[];
}

async function fetchRecentOrders(
  ctx: RouterContext,
  barId: string,
): Promise<RecentBarOrder[]> {
  const { data, error } = await ctx.supabase.rpc("recent_bar_orders", {
    p_bar: barId,
    p_limit: 9,
  });
  if (error) {
    console.error("dine.recent_orders.fail", error);
    return [];
  }
  return (data ?? []) as RecentBarOrder[];
}

async function fetchItemDetail(
  ctx: RouterContext,
  itemId: string,
): Promise<TopBarItem | null> {
  const { data, error } = await ctx.supabase
    .from("items")
    .select(
      "id, name, short_description, price_minor, currency, is_available, categories(name)",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) {
    console.error("dine.item_detail.fail", error);
    return null;
  }
  return {
    item_id: data.id,
    item_name: data.name,
    short_description: data.short_description ?? null,
    price_minor: data.price_minor,
    currency: data.currency,
    category_name: data.categories?.name ?? null,
    is_available: data.is_available,
    total_qty: 0,
    last_order: null,
  };
}
