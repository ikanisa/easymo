import type { RouterContext } from "../../types.ts";
import { sendButtons, sendList, sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { DINE_IDS, makeOrderRowId, makeReviewItemRowId } from "./ids.ts";
import { DINE_STATE, setDineState } from "./state.ts";
import { fmtCurrency, truncate } from "../../utils/text.ts";

const ENTRY_EMOJI = "🍽️";
const MANAGER_EMOJI = "🛠️";
const FORM_EMOJI = "📝";
const INFO_EMOJI = "ℹ️";
const WARNING_EMOJI = "⚠️";

const ORDERS_PAGE_SIZE = 9;
const REVIEW_PAGE_SIZE = 9;

type ManagerContext = {
  barId?: string | null;
  barName?: string | null;
  barSlug?: string | null;
};

type ManagerResolution = {
  context: ManagerContext;
  hasManagedBar: boolean;
};

type RecentBarOrder = {
  order_id: string;
  order_code: string;
  created_at: string | null;
  total_minor: number | null;
  currency: string | null;
  items: RecentBarOrderItem[];
};

type ItemDetail = {
  id: string;
  name: string;
  short_description: string | null;
  price_minor: number;
  currency: string | null;
  category_name: string | null;
  is_available: boolean;
  menu_id: string | null;
};

type RecentBarOrderItem = {
  name: string;
  qty: number;
};

type BarNumberRecord = {
  number_e164: string;
  role: string | null;
  is_active: boolean;
  verified_at: string | null;
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

async function resolveManagerContext(
  ctx: RouterContext,
  context: ManagerContext,
): Promise<ManagerResolution> {
  if (context.barId) {
    return { context, hasManagedBar: true };
  }
  const waId = normalizeWa(ctx.from);
  try {
    const { data, error } = await ctx.supabase
      .from("bar_numbers")
      .select("bar_id, bars(name, slug)")
      .eq("number_e164", waId)
      .eq("role", "manager")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data?.bar_id) {
      return {
        context: {
          barId: data.bar_id,
          barName: data.bars?.name ?? context.barName ?? null,
          barSlug: data.bars?.slug ?? context.barSlug ?? null,
        },
        hasManagedBar: true,
      };
    }
  } catch (error) {
    console.error("dine.manager.resolve_fail", error);
  }
  return {
    context: { ...context },
    hasManagedBar: false,
  };
}

async function ensureBarContext(
  ctx: RouterContext,
  context: ManagerContext,
  _message: string,
): Promise<ManagerContext | null> {
  if (context.barId) return context;
  await sendText(ctx.from, "You don’t have vendor access.");
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
  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.entry.title"),
    body: t(ctx.locale, "dine.entry.body"),
    sectionTitle: t(ctx.locale, "common.options"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows: [
      { id: IDS.DINEIN_BARS_VIEW_LIST, title: t(ctx.locale, "dine.entry.view_bars") },
      { id: IDS.DINEIN_BARS_MANAGE, title: t(ctx.locale, "dine.entry.bar_manager") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.buttons.back") },
    ],
  });
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
    title: t(ctx.locale, "dine.entry.title"),
    body: t(ctx.locale, "dine.entry.body"),
    sectionTitle: t(ctx.locale, "common.options"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows: [
      { id: IDS.DINEIN_BARS_VIEW_LIST, title: t(ctx.locale, "dine.entry.view_bars") },
      { id: IDS.DINEIN_BARS_MANAGE, title: t(ctx.locale, "dine.entry.bar_manager") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.buttons.back") },
    ],
  });
}

export async function showManagerEntry(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const resolved = await resolveManagerContext(ctx, context);
  await setDineState(ctx, DINE_STATE.MANAGER_ENTRY, {
    back: DINE_STATE.MENU,
    data: contextData(resolved.context),
  });
  await sendButtons(ctx.from, t(ctx.locale, "dine.manager.title"), [{
    id: IDS.DINEIN_BARS_MANAGER_VIEW,
    title: t(ctx.locale, "common.buttons.view"),
  }]);
}

export async function showManagerMenu(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const resolved = await resolveManagerContext(ctx, context);
  const nextContext = resolved.context;
  await setDineState(ctx, DINE_STATE.MANAGER_MENU, {
    back: DINE_STATE.MANAGER_ENTRY,
    data: contextData(nextContext, { hasManagedBar: resolved.hasManagedBar }),
  });
  const rows = resolved.hasManagedBar
    ? [
      { id: IDS.DINEIN_BARS_MANAGE_ORDERS, title: "Manage orders" },
      { id: IDS.DINEIN_BARS_UPLOAD, title: t(ctx.locale, "dine.manager.upload_update_menu") },
      { id: IDS.DINEIN_BARS_REVIEW, title: "Review & edit menu" },
      { id: IDS.DINEIN_BARS_NUMBERS_MENU, title: "Add WhatsApp numbers" },
      { id: IDS.BACK_MENU, title: "← Back" },
    ]
    : [
      { id: IDS.DINEIN_BARS_ONBOARD, title: "Onboard bar" },
      { id: IDS.BACK_MENU, title: "← Back" },
    ];
  const bodyLines = resolved.hasManagedBar && nextContext.barName
    ? [`Managing: ${nextContext.barName}`]
    : ["Onboard your bar to unlock tools."];
  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.manager.title"),
    body: bodyLines.join("\n"),
    sectionTitle: t(ctx.locale, "dine.manager.section_manage"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows,
  });
}

export async function showOnboardIdentity(
  ctx: RouterContext,
  context: ManagerContext = {},
  existing: Record<string, unknown> = {},
): Promise<void> {
  const resolved = await resolveManagerContext(ctx, context);
  if (resolved.hasManagedBar && !existing?.allowRepeat) {
    await sendText(ctx.from, "You already have vendor access.");
    await showManagerMenu(ctx, resolved.context);
    return;
  }
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_IDENTITY, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(resolved.context, {
      name,
      location,
      momo,
      whatsapp,
      locationLat: null,
      locationLng: null,
    }),
  });
  await sendText(
    ctx.from,
    "Bar identity — Step 1/4\nPlease reply with Bar/Restaurant name.",
  );
}

export async function handleOnboardIdentityText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ONBOARD_IDENTITY) return false;
  const name = body.trim();
  if (!name.length) {
    await sendText(
      ctx.from,
      "Bar identity — Step 1/4\nPlease reply with Bar/Restaurant name.",
    );
    return true;
  }
  const context = extractManagerContext(state);
  const existing = state.data ?? {};
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_IDENTITY, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, {
      name,
      location,
      momo,
      whatsapp,
      locationLat: null,
      locationLng: null,
    }),
  });
  await showOnboardLocation(ctx, context, {
    name,
    location,
    momo,
    whatsapp,
  });
  return true;
}

export async function showOnboardLocation(
  ctx: RouterContext,
  context: ManagerContext = {},
  existing: Record<string, unknown> = {},
): Promise<void> {
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  const locationLat = typeof existing.locationLat === "number"
    ? existing.locationLat
    : null;
  const locationLng = typeof existing.locationLng === "number"
    ? existing.locationLng
    : null;
  await setDineState(ctx, DINE_STATE.ONBOARD_LOCATION, {
    back: DINE_STATE.ONBOARD_IDENTITY,
    data: contextData(context, {
      name,
      location,
      locationLat,
      locationLng,
      momo,
      whatsapp,
    }),
  });
  await sendText(
    ctx.from,
    "Bar identity — Step 2/4\nSend your Location/Address.\nTip: tap '+' -> Share location (or type the address).",
  );
}

export async function handleOnboardLocationText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ONBOARD_LOCATION) return false;
  const location = body.trim();
  if (!location.length) {
    await sendText(
      ctx.from,
      "Bar identity — Step 2/4\nSend your Location/Address.\nTip: tap '+' -> Share location (or type the address).",
    );
    return true;
  }
  const context = extractManagerContext(state);
  const existing = state.data ?? {};
  const name = typeof existing.name === "string" ? existing.name : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_LOCATION, {
    back: DINE_STATE.ONBOARD_IDENTITY,
    data: contextData(context, {
      name,
      location,
      momo,
      whatsapp,
      locationLat: null,
      locationLng: null,
    }),
  });
  await showOnboardPayment(ctx, context, {
    name,
    location,
    locationLat: null,
    locationLng: null,
    momo,
    whatsapp,
  });
  return true;
}

type SharedLocation = {
  lat: number;
  lng: number;
  name?: string | null;
  address?: string | null;
};

export async function handleOnboardLocationCoordinates(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  location: SharedLocation,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ONBOARD_LOCATION) return false;
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return false;
  }
  const context = extractManagerContext(state);
  const existing = state.data ?? {};
  const name = typeof existing.name === "string" ? existing.name : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  const locationLabel = location.name?.trim().length
    ? location.name.trim()
    : location.address?.trim().length
    ? location.address.trim()
    : `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;

  await setDineState(ctx, DINE_STATE.ONBOARD_LOCATION, {
    back: DINE_STATE.ONBOARD_IDENTITY,
    data: contextData(context, {
      name,
      location: locationLabel,
      momo,
      whatsapp,
      locationLat: location.lat,
      locationLng: location.lng,
    }),
  });

  await showOnboardPayment(ctx, context, {
    name,
    location: locationLabel,
    momo,
    whatsapp,
    locationLat: location.lat,
    locationLng: location.lng,
  });

  return true;
}

export async function showOnboardPayment(
  ctx: RouterContext,
  context: ManagerContext = {},
  existing: Record<string, unknown> = {},
): Promise<void> {
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  const locationLat = typeof existing.locationLat === "number"
    ? existing.locationLat
    : null;
  const locationLng = typeof existing.locationLng === "number"
    ? existing.locationLng
    : null;
  await setDineState(ctx, DINE_STATE.ONBOARD_PAYMENT, {
    back: DINE_STATE.ONBOARD_LOCATION,
    data: contextData(context, {
      name,
      location,
      locationLat,
      locationLng,
      momo,
      whatsapp,
    }),
  });
  await sendText(
    ctx.from,
    "Payments — Step 3/4\nPlease reply with your MoMo code or MOMO number (07xxx).",
  );
}

export async function handleOnboardPaymentText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ONBOARD_PAYMENT) return false;
  const momo = body.trim();
  if (!momo.length) {
    await sendText(
      ctx.from,
      "Payments — Step 3/4\nPlease reply with your MoMo code or MOMO number (07xxx).",
    );
    return true;
  }
  const context = extractManagerContext(state);
  const existing = state.data ?? {};
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_PAYMENT, {
    back: DINE_STATE.ONBOARD_LOCATION,
    data: contextData(context, { name, location, momo, whatsapp }),
  });
  await showOnboardContacts(ctx, context, {
    name,
    location,
    momo,
    whatsapp,
  });
  return true;
}

export async function showOnboardContacts(
  ctx: RouterContext,
  context: ManagerContext = {},
  existing: Record<string, unknown> = {},
): Promise<void> {
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_CONTACTS, {
    back: DINE_STATE.ONBOARD_PAYMENT,
    data: contextData(context, { name, location, momo, whatsapp }),
  });
  await sendText(
    ctx.from,
    "Orders — Step 4/4\nReply with the WhatsApp number(s) to receive orders (comma-separated).\nExample: +2507xxxxxxx, +2507yyyyyyy",
  );
}

export async function handleOnboardContactsText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.ONBOARD_CONTACTS) return false;
  const numbers = extractWhatsappNumbers(body);
  if (!numbers.length) {
    await sendText(
      ctx.from,
      "Orders — Step 4/4\nReply with the WhatsApp number(s) to receive orders (comma-separated).\nExample: +2507xxxxxxx, +2507yyyyyyy",
    );
    return true;
  }
  const context = extractManagerContext(state);
  const existing = state.data ?? {};
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  await setDineState(ctx, DINE_STATE.ONBOARD_CONTACTS, {
    back: DINE_STATE.ONBOARD_PAYMENT,
    data: contextData(context, { name, location, momo, whatsapp: numbers }),
  });
  await showOnboardUpload(ctx, context, {
    name,
    location,
    momo,
    whatsapp: numbers,
  });
  return true;
}

export async function continueOnboardIdentity(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  await showOnboardLocation(
    ctx,
    extractManagerContext(state),
    state.data ?? {},
  );
}

export async function continueOnboardLocation(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  await showOnboardPayment(
    ctx,
    extractManagerContext(state),
    state.data ?? {},
  );
}

export async function continueOnboardPayment(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  await showOnboardContacts(
    ctx,
    extractManagerContext(state),
    state.data ?? {},
  );
}

export async function continueOnboardContacts(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  await showOnboardUpload(
    ctx,
    extractManagerContext(state),
    state.data ?? {},
  );
}

export async function showOnboardUpload(
  ctx: RouterContext,
  context: ManagerContext = {},
  existing: Record<string, unknown> = {},
): Promise<void> {
  const name = typeof existing.name === "string" ? existing.name : null;
  const location = typeof existing.location === "string"
    ? existing.location
    : null;
  const momo = typeof existing.momo === "string" ? existing.momo : null;
  const whatsapp = Array.isArray(existing.whatsapp)
    ? (existing.whatsapp as string[]).filter(Boolean)
    : [];
  await setDineState(ctx, DINE_STATE.ONBOARD_UPLOAD, {
    back: DINE_STATE.ONBOARD_CONTACTS,
    data: contextData(context, {
      mode: "onboard",
      name,
      location,
      momo,
      whatsapp,
    }),
  });
  await sendButtons(
    ctx.from,
    t(ctx.locale, "dine.onboard.upload.prompt"),
    [{ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") }],
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
    t(ctx.locale, "dine.manager.menu.upload_update.prompt"),
    [{ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") }],
  );
}

export async function showManageOrders(
  ctx: RouterContext,
  context: ManagerContext = {},
  options: { page?: number } = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  const page = Math.max(1, options.page ?? 1);
  await setDineState(ctx, DINE_STATE.MANAGE_ORDERS, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { page }),
  });
  if (!ensured) return;

  const { orders, total } = await fetchRecentOrders(
    ctx,
    ensured.barId!,
    page,
  );
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

  await setDineState(ctx, DINE_STATE.MANAGE_ORDERS, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(ensured, {
      orders,
      page,
      totalPages,
    }),
  });

  if (!orders.length) {
    await sendButtons(ctx.from, `${INFO_EMOJI} ${t(ctx.locale, "dine.manager.orders.none")}`, [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: t(ctx.locale, "common.buttons.done"),
    }]);
    return;
  }

  const rows = orders.map((order) => ({
    id: makeOrderRowId(order.order_id),
    title: formatOrderTitle(order),
    description: formatOrderDescription(order),
  }));

  if (page < totalPages) {
    rows.push({
      id: IDS.DINEIN_BARS_MANAGE_ORDERS_NEXT,
      title: t(ctx.locale, "common.buttons.next_page"),
    });
  }
  if (page > 1) {
    rows.push({
      id: IDS.DINEIN_BARS_MANAGE_ORDERS_PREV,
      title: t(ctx.locale, "common.buttons.prev_page"),
    });
  }
  rows.push({ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") });

  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.manager.orders.recent_title", { page: String(page) }),
    body: t(ctx.locale, "dine.manager.orders.recent_body"),
    sectionTitle: t(ctx.locale, "dine.manager.orders.section"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows,
  });
}

export async function showNumbersMenu(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.NUMBERS_MENU, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.manager.numbers.title"),
    body: t(ctx.locale, "dine.manager.choose_what_to_do"),
    sectionTitle: t(ctx.locale, "common.actions"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows: [
      { id: IDS.DINEIN_BARS_NUMBERS_VIEW, title: t(ctx.locale, "dine.manager.numbers.current") },
      { id: IDS.DINEIN_BARS_NUMBERS_ADD, title: t(ctx.locale, "dine.manager.numbers.add") },
      { id: IDS.DINEIN_BARS_NUMBERS_REMOVE, title: t(ctx.locale, "dine.manager.numbers.remove") },
      { id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") },
    ],
  });
}

export async function showCurrentNumbers(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  await setDineState(ctx, DINE_STATE.NUMBERS_VIEW, {
    back: DINE_STATE.NUMBERS_MENU,
    data: contextData(context),
  });
  if (!ensured) return;
  const numbers = await fetchBarNumbers(ctx, ensured.barId!);
  await setDineState(ctx, DINE_STATE.NUMBERS_VIEW, {
    back: DINE_STATE.NUMBERS_MENU,
    data: contextData(ensured, { numbers }),
  });
  const summary = numbers.length
    ? numbers.map((entry) => formatNumberRow(entry)).join("\n")
    : "No numbers yet.";
  await sendButtons(
    ctx.from,
    `${t(ctx.locale, "dine.manager.numbers.current_header")}\n${summary}`,
    [{
      id: IDS.DINEIN_BARS_NUMBERS_MENU,
      title: t(ctx.locale, "common.buttons.back"),
    }],
  );
}

export async function promptAddNumber(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  await setDineState(ctx, DINE_STATE.NUMBERS_ADD, {
    back: DINE_STATE.NUMBERS_MENU,
    data: contextData(context, { numbers: [] }),
  });
  if (!ensured) return;
  await sendButtons(
    ctx.from,
    "Add number\nReply with the WhatsApp number (E.164), e.g. +2507xxxxxxx",
    [{
      id: IDS.DINEIN_BARS_NUMBERS_ADD,
      title: "Add",
    }],
  );
}

export async function showReviewIntro(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  await setDineState(ctx, DINE_STATE.REVIEW_LIST, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  if (!ensured) return;
  await showReviewList(ctx, ensured, { page: 1 });
}

export async function showEditMenu(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  await setDineState(ctx, DINE_STATE.EDIT_MENU, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context),
  });
  if (!ensured) return;
  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.manager.menu.maintenance.title"),
    body: ensured.barName
      ? t(ctx.locale, "dine.manager.menu.maintenance.managing", { bar: ensured.barName })
      : t(ctx.locale, "dine.manager.menu.maintenance.choose"),
    sectionTitle: t(ctx.locale, "common.actions"),
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows: [
      { id: IDS.DINEIN_BARS_EDIT_UPLOAD, title: t(ctx.locale, "dine.manager.menu.upload_pdf") },
      { id: IDS.DINEIN_BARS_EDIT_DELETE, title: t(ctx.locale, "dine.manager.menu.delete_all") },
      {
        id: IDS.DINEIN_BARS_EDIT_REMOVE_CATEGORIES,
        title: t(ctx.locale, "dine.manager.menu.remove_categories"),
      },
      { id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") },
    ],
  });
}

export async function showDeleteMenuConfirmation(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.EDIT_CONFIRM_DELETE, {
    back: DINE_STATE.EDIT_MENU,
    data: contextData(context),
  });
  await sendButtons(
    ctx.from,
    "Confirm you want to delete all menu items. This cannot be undone.",
    [{
      id: IDS.DINEIN_BARS_EDIT_CONFIRM_DELETE,
      title: "Confirm delete",
    }],
  );
}

export async function showRemoveCategoriesConfirmation(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.EDIT_CONFIRM_REMOVE_CATEGORIES, {
    back: DINE_STATE.EDIT_MENU,
    data: contextData(context),
  });
  await sendButtons(
    ctx.from,
    "Confirm to remove categories from all items. Items remain.",
    [{
      id: IDS.DINEIN_BARS_EDIT_CONFIRM_REMOVE_CATEGORIES,
      title: "Confirm",
    }],
  );
}

export async function handleDeleteMenuConfirm(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const ensured = await ensureBarContext(ctx, context);
  if (!ensured) return;
  try {
    await ctx.supabase
      .from("items")
      .update({ is_available: false })
      .eq("bar_id", ensured.barId);
    await ctx.supabase
      .from("menus")
      .update({ status: "archived", published_at: null })
      .eq("bar_id", ensured.barId);
    await sendButtons(ctx.from, "All items deleted. ✅", [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
    }]);
  } catch (error) {
    console.error("dine.menu.delete_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Failed to delete menu.`,
      [{
        id: IDS.DINEIN_BARS_EDIT_MENU,
        title: "Back",
      }],
    );
  }
}

export async function handleRemoveCategoriesConfirm(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const ensured = await ensureBarContext(ctx, context);
  if (!ensured) return;
  try {
    await ctx.supabase
      .from("items")
      .update({ category_id: null })
      .eq("bar_id", ensured.barId);
    await sendButtons(ctx.from, "Categories removed. ✅", [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
    }]);
    await showEditMenu(ctx, ensured);
  } catch (error) {
    console.error("dine.menu.clear_categories_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Failed to clear categories.`,
      [{
        id: IDS.DINEIN_BARS_EDIT_MENU,
        title: "Back",
      }],
    );
  }
}

export async function showReviewList(
  ctx: RouterContext,
  context: ManagerContext,
  options: { page?: number } = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  const page = Math.max(1, options.page ?? 1);
  await setDineState(ctx, DINE_STATE.REVIEW_LIST, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(context, { page }),
  });
  if (!ensured) return;

  const { items, total } = await fetchReviewItems(ctx, ensured.barId!, page);
  const totalPages = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));

  await setDineState(ctx, DINE_STATE.REVIEW_LIST, {
    back: DINE_STATE.MANAGER_MENU,
    data: contextData(ensured, {
      items,
      page,
      totalPages,
    }),
  });

  if (!items.length) {
    await sendButtons(ctx.from, `${INFO_EMOJI} No menu items published yet.`, [{
      id: IDS.DINEIN_BARS_UPLOAD,
      title: t(ctx.locale, "dine.manager.menu.upload_menu"),
    }]);
    return;
  }

  const rows = items.map((item) => ({
    id: makeReviewItemRowId(item.id),
    title: formatItemTitle(item),
    description: formatItemDescription(item),
  }));

  if (page < totalPages) {
    rows.push({ id: IDS.DINEIN_BARS_REVIEW_NEXT_PAGE, title: t(ctx.locale, "common.buttons.next_page") });
  }
  if (page > 1) {
    rows.push({ id: IDS.DINEIN_BARS_REVIEW_PREV_PAGE, title: t(ctx.locale, "common.buttons.prev_page") });
  }
  rows.push({ id: IDS.DINEIN_BARS_MANAGER_VIEW, title: t(ctx.locale, "common.buttons.back") });

  await sendList(ctx.from, {
    title: t(ctx.locale, "dine.manager.menu.items.title", { page: String(page) }),
    body: t(ctx.locale, "dine.manager.menu.items.body_hint"),
    sectionTitle: t(ctx.locale, "dine.manager.menu.items.section"),
    buttonText: t(ctx.locale, "common.buttons.view"),
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
    ? state?.data?.items as ItemDetail[]
    : [];
  const cached = cachedItems.find((item) => item.id === itemId);
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
      itemName: detail.name,
      itemPriceMinor: detail.price_minor,
      itemCurrency: detail.currency,
      itemCategory: detail.category_name,
      itemAvailable: detail.is_available,
      itemMenuId: detail.menu_id ?? null,
    }),
  });
  await sendList(ctx.from, {
    title: `Item: ${detail.name}`,
    body: formatItemDescription(detail),
    sectionTitle: "Actions",
    buttonText: t(ctx.locale, "common.buttons.view"),
    rows: [
      { id: IDS.DINEIN_BARS_REVIEW_EDIT_NAME, title: "Change name" },
      { id: IDS.DINEIN_BARS_REVIEW_EDIT_PRICE, title: "Change price" },
      {
        id: IDS.DINEIN_BARS_REVIEW_EDIT_DESCRIPTION,
        title: "Change description",
      },
      { id: IDS.DINEIN_BARS_REVIEW_EDIT_CATEGORY, title: "Change category" },
      {
        id: IDS.DINEIN_BARS_REVIEW_TOGGLE,
        title: detail.is_available ? "Mark unavailable" : "Mark available",
      },
      { id: IDS.DINEIN_BARS_REVIEW, title: "← Back" },
    ],
  });
}

export async function promptReviewEditField(
  ctx: RouterContext,
  context: ManagerContext,
  itemId: string,
  itemName: string,
  field: "name" | "price" | "description" | "category",
  extra: { itemMenuId?: string | null } = {},
): Promise<void> {
  await setDineState(ctx, DINE_STATE.REVIEW_EDIT_FIELD, {
    back: DINE_STATE.REVIEW_ITEM_MENU,
    data: contextData(context, {
      itemId,
      itemName,
      field,
      itemMenuId: extra.itemMenuId ?? null,
    }),
  });
  const prompt = field === "name"
    ? "Send the new name."
    : field === "price"
    ? "Send the new price (numbers only)."
    : field === "description"
    ? "Send the new description."
    : "Send the new category.";
  await sendText(ctx.from, `Item: ${itemName}\n${prompt}`);
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
      data.field === "description" || data.field === "category"
    ? data.field
    : null;
  if (!itemId || !field) return false;
  const context = extractManagerContext(state);
  try {
    if (field === "name") {
      const value = body.trim();
      if (!value) throw new Error("Name required");
      await ctx.supabase.from("items").update({ name: value }).eq("id", itemId);
      await sendButtons(ctx.from, "Updated. ✅", [{
        id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
      }]);
      return true;
    }
    if (field === "price") {
      const valueMinor = parsePriceToMinor(body);
      if (valueMinor <= 0) throw new Error("Enter a valid price");
      await ctx.supabase.from("items").update({ price_minor: valueMinor }).eq(
        "id",
        itemId,
      );
      await sendButtons(ctx.from, "Updated. ✅", [{
        id: IDS.DINEIN_BARS_REVIEW,
        title: copy("buttons.viewMenu", {}, ctx.locale),
      }]);
      return true;
    }
    if (field === "description") {
      const description = body.trim();
      await ctx.supabase.from("items").update({
        short_description: description || null,
      }).eq("id", itemId);
      await sendButtons(ctx.from, "Updated. ✅", [{
        id: IDS.DINEIN_BARS_REVIEW,
        title: copy("buttons.viewMenu", {}, ctx.locale),
      }]);
      return true;
    }
    const categoryName = body.trim();
    if (!categoryName) throw new Error("Category required");
    const barId = context.barId ?? null;
    const menuId = typeof data.itemMenuId === "string" ? data.itemMenuId : null;
    const resolvedMenuId = menuId ?? await resolveMenuIdForItem(ctx, itemId);
    const resolvedBarId = barId ?? await resolveBarIdForItem(ctx, itemId);
    if (!resolvedMenuId || !resolvedBarId) {
      throw new Error("Unable to resolve menu for item");
    }
    const categoryId = await ensureCategoryForMenu(
      ctx,
      resolvedMenuId,
      resolvedBarId,
      categoryName,
    );
    await ctx.supabase.from("items").update({ category_id: categoryId }).eq(
      "id",
      itemId,
    );
    await sendButtons(ctx.from, "Updated. ✅", [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
    }]);
    return true;
  } catch (error) {
    console.error("dine.review.edit_fail", error);
    await sendButtons(ctx.from, `${WARNING_EMOJI} Update failed. Try again.`, [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
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
    await sendButtons(ctx.from, "Availability updated. ✅", [{
      id: IDS.DINEIN_BARS_REVIEW,
      title: copy("buttons.viewMenu", {}, ctx.locale),
    }]);
  } catch (error) {
    console.error("dine.review.toggle_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Update failed. Try again.`,
      [{
        id: IDS.DINEIN_BARS_REVIEW,
        title: copy("buttons.viewMenu", {}, ctx.locale),
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
    await sendButtons(ctx.from, `${WARNING_EMOJI} ${t(ctx.locale, "dine.manager.orders.not_found")}`, [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: t(ctx.locale, "common.buttons.done"),
    }]);
    return;
  }
  const summary = formatOrderSummary(match);
  await sendButtons(
    ctx.from,
    summary,
    [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: t(ctx.locale, "common.buttons.done"),
    }],
  );
}

export async function handleNumbersAddText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.NUMBERS_ADD) return false;
  const context = extractManagerContext(state);
  const numbers = extractWhatsappNumbers(body);
  const firstNumber = numbers[0];
  if (!firstNumber) {
    await sendButtons(
      ctx.from,
      "Add number\nReply with the WhatsApp number (E.164), e.g. +2507xxxxxxx",
      [{
        id: IDS.DINEIN_BARS_NUMBERS_ADD,
        title: "Add",
      }],
    );
    return true;
  }
  const data = contextData(context, { numbers: [firstNumber] });
  await setDineState(ctx, DINE_STATE.NUMBERS_ADD, {
    back: DINE_STATE.NUMBERS_MENU,
    data,
  });
  await handleNumbersAddSubmit(ctx, { data });
  return true;
}

export async function handleNumbersAddSubmit(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const ensured = await ensureBarContext(ctx, context);
  const numbers = Array.isArray(state.data?.numbers)
    ? state.data?.numbers as string[]
    : [];
  if (!ensured) return;
  if (!numbers.length) {
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} ${t(ctx.locale, "dine.manager.numbers.add_at_least_one")}`,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_MENU,
        title: t(ctx.locale, "common.buttons.back"),
      }],
    );
    return;
  }
  try {
    await ctx.supabase.from("bar_numbers").upsert(
      numbers.map((number) => ({
        bar_id: ensured.barId,
        number_e164: number,
        role: "staff",
        is_active: true,
      })),
      { onConflict: "bar_id,number_e164" },
    );
    const successMessage = numbers.length === 1
      ? "Number added. ✅"
      : "Numbers added. ✅";
    await sendButtons(
      ctx.from,
      successMessage,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_VIEW,
      title: t(ctx.locale, "dine.manager.numbers.view"),
      }],
    );
    await showCurrentNumbers(ctx, ensured);
  } catch (error) {
    console.error("dine.numbers.add_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Failed to save numbers. Try again soon.`,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_MENU,
        title: "← Back",
      }],
    );
  }
}

export async function promptRemoveNumber(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  const ensured = await ensureBarContext(ctx, context);
  await setDineState(ctx, DINE_STATE.NUMBERS_REMOVE, {
    back: DINE_STATE.NUMBERS_MENU,
    data: contextData(context, { numbers: [] }),
  });
  if (!ensured) return;
  const numbers = await fetchBarNumbers(ctx, ensured.barId!);
  await setDineState(ctx, DINE_STATE.NUMBERS_REMOVE, {
    back: DINE_STATE.NUMBERS_MENU,
    data: contextData(ensured, { existingNumbers: numbers, remove: [] }),
  });
  const listText = numbers.length
    ? numbers.map((entry, index) => `${index + 1}. ${formatNumberRow(entry)}`)
      .join("\n")
    : "No numbers yet.";
  await sendButtons(
    ctx.from,
    `Remove number\nReply with the number to remove (E.164), as listed.\n${listText}`,
    [{
      id: IDS.DINEIN_BARS_NUMBERS_REMOVE,
      title: numbers.length ? "Remove" : "← Back",
    }],
  );
}

export async function handleNumbersRemoveText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  if (state.key !== DINE_STATE.NUMBERS_REMOVE) return false;
  const context = extractManagerContext(state);
  const removeList = extractWhatsappNumbers(body);
  const remove = removeList.length ? [removeList[0]] : [];
  const existingNumbers = Array.isArray(state.data?.existingNumbers)
    ? state.data?.existingNumbers as BarNumberRecord[]
    : [];
  const data = contextData(context, { existingNumbers, remove });
  await setDineState(ctx, DINE_STATE.NUMBERS_REMOVE, {
    back: DINE_STATE.NUMBERS_MENU,
    data,
  });
  if (!remove.length) {
    await sendButtons(
      ctx.from,
      "Remove number\nReply with the number to remove (E.164), as listed.",
      [{
        id: IDS.DINEIN_BARS_NUMBERS_REMOVE,
        title: "Remove",
      }],
    );
    return true;
  }
  await handleNumbersRemoveSubmit(ctx, { data });
  return true;
}

export async function handleNumbersRemoveSubmit(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const ensured = await ensureBarContext(ctx, context);
  if (!ensured) return;
  const remove = Array.isArray(state.data?.remove)
    ? state.data?.remove as string[]
    : [];
  if (!remove.length) {
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} Reply with numbers to remove.`,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_MENU,
        title: "← Back",
      }],
    );
    return;
  }
  try {
    await ctx.supabase
      .from("bar_numbers")
      .delete()
      .eq("bar_id", ensured.barId)
      .in("number_e164", remove);
    const successMessage = remove.length === 1
      ? "Number removed. ✅"
      : "Numbers removed. ✅";
    await sendButtons(
      ctx.from,
      successMessage,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_VIEW,
        title: t(ctx.locale, "dine.manager.numbers.view"),
      }],
    );
    await showCurrentNumbers(ctx, ensured);
  } catch (error) {
    console.error("dine.numbers.remove_fail", error);
    await sendButtons(
      ctx.from,
      `${WARNING_EMOJI} ${t(ctx.locale, "dine.manager.numbers.remove_failed")}`,
      [{
        id: IDS.DINEIN_BARS_NUMBERS_MENU,
        title: t(ctx.locale, "common.buttons.back"),
      }],
    );
  }
}

export async function showAddWhatsappPrompt(
  ctx: RouterContext,
  context: ManagerContext = {},
): Promise<void> {
  await promptAddNumber(ctx, context);
}

export async function handleAddWhatsappText(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  body: string,
): Promise<boolean> {
  return await handleNumbersAddText(ctx, state, body);
}

export async function handleAddWhatsappSave(
  ctx: RouterContext,
  state?: { data?: Record<string, unknown> },
): Promise<void> {
  await handleNumbersAddSubmit(ctx, state ?? { data: {} });
}

export async function handleUploadDone(
  ctx: RouterContext,
  state: { data?: Record<string, unknown> },
): Promise<void> {
  const context = extractManagerContext(state);
  const message = t(ctx.locale, "dine.manager.upload.thanks_reading_menu");
  await sendText(ctx.from, message);
  await setDineState(ctx, DINE_STATE.MANAGER_MENU, {
    back: DINE_STATE.MANAGER_ENTRY,
    data: contextData(context),
  });
}

export async function handlePublish(ctx: RouterContext): Promise<void> {
  await sendButtons(
    ctx.from,
    `${MANAGER_EMOJI} ${t(ctx.locale, "dine.manager.publish.requested")}`,
    [{
      id: IDS.DINEIN_BARS_MANAGER_VIEW,
      title: t(ctx.locale, "dine.manager.back_to_manager"),
    }],
  );
}

function extractWhatsappNumbers(body: string): string[] {
  const candidates = body.split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const results = new Set<string>();
  for (const candidate of candidates) {
    const parts = candidate.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      const cleaned = part.replace(/[^0-9+]/g, "");
      if (!cleaned) continue;
      const normalized = cleaned.startsWith("+")
        ? cleaned
        : `+${cleaned.replace(/^\++/, "")}`;
      if (/^\+[0-9]{6,15}$/.test(normalized)) {
        results.add(normalized);
      }
    }
  }
  return Array.from(results);
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

function normalizeWa(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.length) return trimmed;
  const digits = trimmed.replace(/^\++/, "");
  return `+${digits}`;
}

function formatItemTitle(item: ItemDetail): string {
  return truncate(item.name, 60);
}

function formatItemDescription(item: ItemDetail): string {
  const price = fmtCurrency(item.price_minor, item.currency ?? "RWF");
  const parts: string[] = [price];
  if (item.category_name) parts.push(truncate(item.category_name, 32));
  if (item.short_description) parts.push(truncate(item.short_description, 60));
  if (!item.is_available) parts.push("Unavailable");
  return parts.join(" • ");
}

function formatOrderTitle(order: RecentBarOrder): string {
  const top = order.items[0];
  if (!top) return `#${order.order_code}`;
  const qty = top.qty > 1 ? ` ×${top.qty}` : "";
  return truncate(`${top.name}${qty}`, 60);
}

function formatOrderDescription(order: RecentBarOrder): string {
  const amount = typeof order.total_minor === "number"
    ? fmtCurrency(order.total_minor, order.currency ?? "RWF")
    : "N/A";
  const parts: string[] = [`Total: ${amount}`];
  if (order.items.length > 1) {
    const other = order.items.slice(1).map((item) => {
      const qty = item.qty > 1 ? ` ×${item.qty}` : "";
      return truncate(`${item.name}${qty}`, 40);
    });
    if (other.length) parts.push(`Other items: ${other.join(", ")}`);
  }
  return parts.join(" • ");
}

function formatOrderSummary(order: RecentBarOrder): string {
  const amount = typeof order.total_minor === "number"
    ? fmtCurrency(order.total_minor, order.currency ?? "RWF")
    : "N/A";
  const itemsText = order.items.length
    ? order.items
      .map((item) => {
        const qty = item.qty > 1 ? ` ×${item.qty}` : "";
        return `${item.name}${qty}`;
      })
      .join(", ")
    : "No items recorded.";
  return [
    `Order ${order.order_code}`,
    `Total: ${amount}`,
    `Items: ${itemsText}`,
  ].join("\n");
}

async function fetchBarNumbers(
  ctx: RouterContext,
  barId: string,
): Promise<BarNumberRecord[]> {
  const { data, error } = await ctx.supabase
    .from("bar_numbers")
    .select("number_e164, role, is_active, verified_at")
    .eq("bar_id", barId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("dine.bar_numbers.fetch_fail", error);
    return [];
  }
  return (data ?? []) as BarNumberRecord[];
}

function formatNumberRow(entry: BarNumberRecord): string {
  const parts = [entry.number_e164];
  if (entry.role) parts.push(entry.role);
  if (!entry.is_active) parts.push("inactive");
  if (entry.verified_at) parts.push("verified");
  return parts.join(" • ");
}

async function fetchRecentOrders(
  ctx: RouterContext,
  barId: string,
  page: number,
): Promise<{ orders: RecentBarOrder[]; total: number }> {
  const offset = (Math.max(1, page) - 1) * ORDERS_PAGE_SIZE;
  const rangeEnd = offset + ORDERS_PAGE_SIZE - 1;
  const { data, error, count } = await ctx.supabase
    .from("orders")
    .select(
      "id, order_code, created_at, total_minor, currency, order_items(item_name, qty)",
      { count: "exact" },
    )
    .eq("bar_id", barId)
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd);
  if (error) {
    console.error("dine.recent_orders.fail", error);
    return { orders: [], total: 0 };
  }
  const orders = (data ?? []).map((row) => ({
    order_id: row.id,
    order_code: row.order_code ?? "",
    created_at: row.created_at ?? null,
    total_minor: typeof row.total_minor === "number" ? row.total_minor : null,
    currency: row.currency ?? null,
    items: Array.isArray(row.order_items)
      ? row.order_items.map((item: Record<string, unknown>) => ({
        name: String(item.item_name ?? "Item"),
        qty: typeof item.qty === "number" ? item.qty : 1,
      }))
      : [],
  }));
  return {
    orders,
    total: typeof count === "number" ? count : orders.length,
  };
}

async function fetchReviewItems(
  ctx: RouterContext,
  barId: string,
  page: number,
): Promise<{ items: ItemDetail[]; total: number }> {
  const offset = (Math.max(1, page) - 1) * REVIEW_PAGE_SIZE;
  const rangeEnd = offset + REVIEW_PAGE_SIZE - 1;
  const { data, error, count } = await ctx.supabase
    .from("items")
    .select(
      "id, bar_id, menu_id, name, short_description, price_minor, currency, is_available, categories(name), menus!inner(status)",
      { count: "exact" },
    )
    .eq("bar_id", barId)
    .eq("menus.status", "published")
    .order("name", { ascending: true })
    .range(offset, rangeEnd);
  if (error) {
    console.error("dine.items.fetch_fail", error);
    return { items: [], total: 0 };
  }
  const items = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    short_description: row.short_description ?? null,
    price_minor: typeof row.price_minor === "number" ? row.price_minor : 0,
    currency: row.currency ?? null,
    category_name: row.categories?.name ?? null,
    is_available: Boolean(row.is_available),
    menu_id: row.menu_id ?? null,
  }));
  return {
    items,
    total: typeof count === "number" ? count : items.length,
  };
}

async function resolveMenuIdForItem(
  ctx: RouterContext,
  itemId: string,
): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("items")
    .select("menu_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) {
    console.error("dine.item_menu.resolve_fail", error);
    return null;
  }
  return data?.menu_id ?? null;
}

async function resolveBarIdForItem(
  ctx: RouterContext,
  itemId: string,
): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("items")
    .select("bar_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) {
    console.error("dine.item_bar.resolve_fail", error);
    return null;
  }
  return data?.bar_id ?? null;
}

async function ensureCategoryForMenu(
  ctx: RouterContext,
  menuId: string,
  barId: string,
  categoryName: string,
): Promise<string> {
  const trimmed = categoryName.trim();
  const normalized = trimmed.replace(/\s+/g, " ").trim();
  const existing = await ctx.supabase
    .from("categories")
    .select("id")
    .eq("menu_id", menuId)
    .ilike("name", normalized)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error;
  }
  if (existing.data?.id) return existing.data.id;

  const { data: maxRow, error: orderError } = await ctx.supabase
    .from("categories")
    .select("sort_order")
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) {
    console.error("dine.category.order_fail", orderError);
  }
  const nextSort = typeof maxRow?.sort_order === "number"
    ? maxRow.sort_order + 1
    : 0;

  const { data, error } = await ctx.supabase
    .from("categories")
    .insert({
      bar_id: barId,
      menu_id: menuId,
      name: normalized,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function fetchItemDetail(
  ctx: RouterContext,
  itemId: string,
): Promise<ItemDetail | null> {
  const { data, error } = await ctx.supabase
    .from("items")
    .select(
      "id, menu_id, name, short_description, price_minor, currency, is_available, categories(name)",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) {
    console.error("dine.item_detail.fail", error);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    short_description: data.short_description ?? null,
    price_minor: data.price_minor,
    currency: data.currency,
    category_name: data.categories?.name ?? null,
    is_available: data.is_available,
    menu_id: data.menu_id ?? null,
  } as ItemDetail;
}
