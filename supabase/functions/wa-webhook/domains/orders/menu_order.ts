import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { setState, clearState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { t } from "../../i18n/translator.ts";
import { safeRowDesc, safeRowTitle, stripMarkdown, truncate } from "../../utils/text.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";

export const MENU_ORDER_BROWSER_STATE = "menu_order_browser";
export const MENU_ORDER_ACTIONS_STATE = "menu_order_actions";
export const MENU_ITEM_PREFIX = "menu_item::";
export const MENU_LIST_MORE = "menu_list_more";

export type MenuOrderItem = {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
  description?: string | null;
};

export type MenuOrderSelection = {
  itemId: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
};

export type MenuOrderSession = {
  vendorType: "bar" | "pharmacy" | "shop";
  vendorId: string;
  vendorName: string;
  contactNumbers: string[];
  menuItems: MenuOrderItem[];
  selections: MenuOrderSelection[];
  page?: number;
};

const MAX_MENU_ROWS = 9; // WhatsApp limit (9 items + back row)

export async function startMenuOrderSession(
  ctx: RouterContext,
  session: MenuOrderSession,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const normalized: MenuOrderSession = {
    ...session,
    menuItems: session.menuItems ?? [],
    selections: session.selections ?? [],
  };
  if (!normalized.menuItems.length) {
    await sendText(
      ctx.from,
      t(ctx.locale, "menu.order.menu_empty", { vendor: normalized.vendorName }),
    );
    return true;
  }
  await showMenuList(ctx, { ...normalized, page: normalized.page ?? 0 });
  return true;
}

export async function handleMenuItemSelection(
  ctx: RouterContext,
  session: MenuOrderSession,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const menuItemId = selectionId.replace(MENU_ITEM_PREFIX, "");
  const item = session.menuItems.find((entry) => entry.id === menuItemId);
  if (!item) {
    await sendText(ctx.from, t(ctx.locale, "menu.order.item_missing"));
    return true;
  }
  const updated: MenuOrderSession = {
    ...session,
    selections: [
      ...(session.selections ?? []),
      {
        itemId: item.id,
        name: item.name,
        price: item.price,
        currency: item.currency,
        category: item.category ?? undefined,
      },
    ],
    page: session.page ?? 0,
  };
  await setState(ctx.supabase, ctx.profileId, {
    key: MENU_ORDER_ACTIONS_STATE,
    data: updated,
  });
  const addedLine = t(ctx.locale, "menu.order.added", {
    item: item.name,
    price: formatPriceDisplay(ctx.locale, item.price, item.currency),
  });
  const summary = formatOrderSummary(ctx, updated, {
    includeHeader: true,
    includeTotals: false,
  });
  await sendButtonsMessage(
    ctx,
    `${addedLine}\n\n${summary}`,
    buildButtons(
      { id: IDS.MENU_ORDER_ADD, title: t(ctx.locale, "menu.order.buttons.add") },
      {
        id: IDS.MENU_ORDER_VIEW,
        title: t(ctx.locale, "menu.order.buttons.view"),
      },
      {
        id: IDS.MENU_ORDER_FINISH,
        title: t(ctx.locale, "menu.order.buttons.finish"),
      },
    ),
    { emoji: "🛒" },
  );
  return true;
}

export async function handleMenuOrderAction(
  ctx: RouterContext,
  session: MenuOrderSession,
  actionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  switch (actionId) {
    case IDS.MENU_ORDER_ADD:
      await showMenuList(ctx, { ...session, page: session.page ?? 0 });
      return true;
    case IDS.MENU_ORDER_VIEW: {
      if (!session.selections.length) {
        await sendText(ctx.from, t(ctx.locale, "menu.order.summary.empty"));
        return true;
      }
      await setState(ctx.supabase, ctx.profileId, {
        key: MENU_ORDER_ACTIONS_STATE,
        data: session,
      });
      const summary = formatOrderSummary(ctx, session, {
        includeHeader: true,
        includeTotals: true,
      });
      await sendButtonsMessage(
        ctx,
        summary,
        buildButtons(
          {
            id: IDS.MENU_ORDER_ADD,
            title: t(ctx.locale, "menu.order.buttons.add"),
          },
          {
            id: IDS.MENU_ORDER_FINISH,
            title: t(ctx.locale, "menu.order.buttons.finish"),
          },
        ),
      );
      return true;
    }
    case IDS.MENU_ORDER_FINISH:
      return await finalizeOrder(ctx, session);
    default:
      return false;
  }
}

async function showMenuList(
  ctx: RouterContext,
  session: MenuOrderSession,
): Promise<void> {
  if (!ctx.profileId) return;
  const totalItems = session.menuItems.length;
  if (!totalItems) {
    await sendText(
      ctx.from,
      t(ctx.locale, "menu.order.menu_empty", { vendor: session.vendorName }),
    );
    return;
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / MAX_MENU_ROWS));
  const currentPage = Math.min(
    Math.max(session.page ?? 0, 0),
    totalPages - 1,
  );
  const startIdx = currentPage * MAX_MENU_ROWS;
  const endIdx = Math.min(startIdx + MAX_MENU_ROWS, totalItems);
  const menuRowsBase = session.menuItems.slice(startIdx, endIdx).map((item) => ({
    id: `${MENU_ITEM_PREFIX}${item.id}`,
    // WhatsApp UI requirement:
    //  - Row title ("header") must be the item name (no markdown, <= 24 chars)
    //  - Row description ("body") contains category and price (<= 72 chars)
    title: safeRowTitle(stripMarkdown(item.name || "")),
    description: safeRowDesc(buildMenuRowDescription(ctx.locale, item)),
  }));
  const sessionWithPage: MenuOrderSession = {
    ...session,
    page: currentPage,
  };
  await setState(ctx.supabase, ctx.profileId, {
    key: MENU_ORDER_BROWSER_STATE,
    data: sessionWithPage,
  });
  const pageInfo = totalPages > 1
    ? t(ctx.locale, "menu.order.list.page_info", {
      page: String(currentPage + 1),
      total: String(totalPages),
      from: String(startIdx + 1),
      to: String(endIdx),
      total_items: String(totalItems),
    })
    : "";
  const bodyText = [t(ctx.locale, "menu.order.list.body", {
    vendor: session.vendorName,
  })];
  if (pageInfo) bodyText.push(pageInfo);
  const menuRows = [...menuRowsBase];
  if (currentPage < totalPages - 1) {
    menuRows.push({
      id: MENU_LIST_MORE,
      title: t(ctx.locale, "menu.order.list.more"),
      description: t(ctx.locale, "menu.order.list.more_desc"),
    });
  }
  const actionRows = [{
    id: IDS.BACK_HOME,
    title: t(ctx.locale, "common.home_button"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  }];
  const sections = [
    {
      title: t(ctx.locale, "menu.order.list.section"),
      rows: menuRows,
    },
    {
      title: t(ctx.locale, "menu.order.list.actions"),
      rows: actionRows,
    },
  ];
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "menu.order.list.title", {
        vendor: session.vendorName,
      }),
      body: bodyText.join("\n\n"),
      sectionTitle: t(ctx.locale, "menu.order.list.section"),
      rows: menuRows,
      sections,
      buttonText: t(ctx.locale, "menu.order.list.button"),
    },
    { emoji: "🍽️" },
  );
}

export async function handleMenuPagination(
  ctx: RouterContext,
  session: MenuOrderSession,
  direction: "next" | "prev",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const totalItems = session.menuItems.length;
  if (!totalItems) return false;
  const totalPages = Math.max(1, Math.ceil(totalItems / MAX_MENU_ROWS));
  const currentPage = Math.min(
    Math.max(session.page ?? 0, 0),
    totalPages - 1,
  );
  const delta = direction === "next" ? 1 : -1;
  const targetPage = Math.min(
    Math.max(currentPage + delta, 0),
    totalPages - 1,
  );
  if (targetPage === currentPage) {
    await showMenuList(ctx, { ...session, page: currentPage });
    return true;
  }
  await showMenuList(ctx, { ...session, page: targetPage });
  return true;
}

async function finalizeOrder(
  ctx: RouterContext,
  session: MenuOrderSession,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (!session.selections.length) {
    await sendText(ctx.from, t(ctx.locale, "menu.order.summary.empty"));
    return true;
  }
  if (!session.contactNumbers.length) {
    await sendText(
      ctx.from,
      t(ctx.locale, "menu.order.no_contacts", { vendor: session.vendorName }),
    );
    return true;
  }
  const orderSummary = formatOrderSummary(ctx, session, {
    includeHeader: true,
    includeTotals: true,
  });
  const vendorMessage = [
    t(ctx.locale, "menu.order.vendor.header"),
    "",
    `*${session.vendorName}*`,
    "",
    orderSummary,
    "",
    t(ctx.locale, "menu.order.vendor.customer", {
      link: buildWhatsAppLink(ctx.from),
    }),
  ].join("\n");
  for (const contact of session.contactNumbers) {
    try {
      await sendText(contact, vendorMessage);
    } catch (error) {
      console.error("menu_order.notify_fail", {
        vendor: session.vendorId,
        contact,
        error: error instanceof Error ? error.message : String(error ?? "err"),
      });
    }
  }
  await sendText(
    ctx.from,
    `${t(ctx.locale, "menu.order.confirmation.user", {
      vendor: session.vendorName,
    })}\n\n${orderSummary}`,
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

function buildMenuRowDescription(
  locale: RouterContext["locale"],
  item: MenuOrderItem,
): string {
  const price = formatPriceDisplay(locale, item.price, item.currency);
  const parts = [
    item.category,
    price || undefined,
  ].filter(Boolean);
  return parts.join(" • ") ||
    t(locale, "menu.order.row.generic");
}

function formatPriceValue(
  price: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (price === null || price === undefined) return "";
  const code = currency && currency.trim() ? currency : "RWF";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(price);
  } catch (_err) {
    return `${price} ${code}`;
  }
}

function formatPriceDisplay(
  locale: RouterContext["locale"],
  price: number | null | undefined,
  currency: string | null | undefined,
): string {
  const label = formatPriceValue(price, currency);
  return label || t(locale, "menu.order.price.unknown");
}

type SummaryOptions = {
  includeHeader: boolean;
  includeTotals: boolean;
};

function formatOrderSummary(
  ctx: RouterContext,
  session: MenuOrderSession,
  options: SummaryOptions,
): string {
  if (!session.selections.length) {
    return t(ctx.locale, "menu.order.summary.empty");
  }
  const grouped = new Map<
    string,
    { name: string; count: number; price?: number | null; currency?: string | null }
  >();
  for (const item of session.selections) {
    const key = `${item.itemId}::${item.price ?? "free"}::${item.currency ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        name: item.name,
        count: 1,
        price: item.price,
        currency: item.currency,
      });
    }
  }
  const lines: string[] = [];
  for (const { name, count, price, currency } of grouped.values()) {
    const priceLabel = formatPriceDisplay(ctx.locale, price ?? null, currency ?? null);
    const qty = count > 1 ? `${count} × ${name}` : name;
    lines.push(
      t(ctx.locale, "menu.order.summary.line", {
        item: qty,
        price: priceLabel,
      }),
    );
  }
  const totalsByCurrency = new Map<string, number>();
  for (const selection of session.selections) {
    if (selection.price === null || selection.price === undefined) continue;
    const code = selection.currency && selection.currency.trim()
      ? selection.currency
      : "RWF";
    totalsByCurrency.set(code, (totalsByCurrency.get(code) ?? 0) + selection.price);
  }
  const totals: string[] = [];
  if (options.includeTotals && totalsByCurrency.size) {
    for (const [code, total] of totalsByCurrency.entries()) {
      totals.push(`• ${formatPriceValue(total, code)}`);
    }
  }
  const parts = [];
  if (options.includeHeader) {
    parts.push(t(ctx.locale, "menu.order.summary.header"));
  }
  parts.push(...lines);
  if (totals.length) {
    parts.push("");
    parts.push(
      t(ctx.locale, "menu.order.summary.total", {
        totals: totals.join("\n"),
      }),
    );
  }
  return parts.join("\n");
}

function buildWhatsAppLink(e164: string): string {
  const digits = e164.startsWith("+") ? e164 : `+${e164}`;
  return `https://wa.me/${digits.replace(/\+/g, "")}`;
}
