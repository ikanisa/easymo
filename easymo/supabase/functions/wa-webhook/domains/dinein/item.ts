import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { DINE_IDS, isItemRow, parseItemId } from "./ids.ts";
import { formatPrice, logFlowAction, truncate } from "./utils.ts";
import { copy } from "./copy.ts";
import {
  createInstantOrder,
  fetchBarProfile,
  fetchItem,
  getEffectiveMomoCode,
  getOrCreateCustomerId,
  type ItemRecord,
  type OrderSnapshot,
} from "./service.ts";
import { notifyOrderCreated } from "../../notify/hooks.ts";

const ITEM_EMOJI = "🍲";
const ORDER_EMOJI = "🧾";
const ERROR_EMOJI = "⚠️";

type ChatState = { key: string; data?: Record<string, unknown> };

type ItemsState = {
  bar_id: string;
  bar_name: string;
  bar_slug?: string | null;
  menu_id: string;
  offset: number;
  total_count: number;
  item_ids: string[];
  next_offset: number | null;
  prev_offset: number | null;
  can_manage?: boolean;
};

type OrderState = {
  order_id: string;
  order_code: string;
  bar_id: string;
  bar_name: string;
  bar_slug?: string | null;
  total_minor: number;
  currency: string;
  ussd_code?: string | null;
  ussd_uri?: string | null;
  payment_instructions?: string | null;
  can_manage?: boolean;
};

export async function handleItemRow(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId || !isItemRow(id)) return false;
  if (state.key !== "dine_items") return false;
  const itemsState = (state.data ?? {}) as Partial<ItemsState>;
  const currentSlug = typeof itemsState.bar_slug === "string"
    ? itemsState.bar_slug
    : null;
  const itemId = parseItemId(id);
  await logFlowAction(ctx, "item_selected", state.key, { item_id: itemId });

  try {
    const item = await fetchItem(ctx.supabase, itemId);
    if (!item || !item.is_available) {
      await sendButtonsMessage(
        ctx,
        copy("items.unavailable"),
        [
          { id: DINE_IDS.ORDER_MORE, title: copy("buttons.orderMore") },
          ...homeOnly(),
        ],
        { emoji: ITEM_EMOJI },
      );
      return true;
    }

    const barId = itemsState.bar_id;
    if (!barId || barId !== item.bar_id) {
      await sendButtonsMessage(
        ctx,
        copy("error.retry"),
        homeOnly(),
        { emoji: ERROR_EMOJI },
      );
      return true;
    }

    const barProfile = await fetchBarProfile(ctx.supabase, barId);
    if (!barProfile) {
      await sendButtonsMessage(
        ctx,
        copy("error.retry"),
        homeOnly(),
        { emoji: ERROR_EMOJI },
      );
      return true;
    }

    if (!item.is_available) {
      await sendButtonsMessage(
        ctx,
        copy("items.unavailable"),
        [
          { id: DINE_IDS.ORDER_MORE, title: copy("buttons.orderMore") },
          ...homeOnly(),
        ],
        { emoji: ITEM_EMOJI },
      );
      return true;
    }

    const profileId = await getOrCreateCustomerId(ctx.supabase, ctx.from);
    const snapshot = await createInstantOrder(ctx.supabase, {
      profileId,
      bar: barProfile,
      item,
    });

    try {
      await notifyOrderCreated({
        orderId: snapshot.orderId,
        barId: snapshot.bar.id,
        orderCode: snapshot.orderCode,
        totalMinor: snapshot.totalMinor,
        currency: snapshot.currency,
        bar: snapshot.bar,
      });
    } catch (notifyErr) {
      await logFlowAction(ctx, "notify_order_created_fail", state.key, {
        order_id: snapshot.orderId,
        message: notifyErr instanceof Error
          ? notifyErr.message
          : String(notifyErr),
      });
    }

    const payOptions = buildPayOptions(snapshot);

    const effectiveSlug = currentSlug ?? barProfile.slug ?? null;

    await setState(ctx.supabase, ctx.profileId, {
      key: "dine_order",
      data: {
        order_id: snapshot.orderId,
        order_code: snapshot.orderCode,
        bar_id: snapshot.bar.id,
        bar_name: snapshot.bar.name,
        bar_slug: effectiveSlug,
        total_minor: snapshot.totalMinor,
        currency: snapshot.currency,
        ussd_code: payOptions.ussd,
        ussd_uri: payOptions.telUri,
        payment_instructions: payOptions.instructions,
        can_manage: Boolean(itemsState.can_manage),
      } satisfies OrderState,
    });

    await sendButtonsMessage(
      ctx,
      buildConfirmationBody(snapshot, item),
      [
        { id: DINE_IDS.PAY_ORDER, title: copy("buttons.payNow") },
        { id: DINE_IDS.ORDER_MORE, title: copy("buttons.orderMore") },
        ...homeOnly(),
      ],
      { emoji: ORDER_EMOJI },
    );
    return true;
  } catch (err) {
    await logFlowAction(ctx, "item_order_error", state.key, {
      item_id: itemId,
      message: err instanceof Error ? err.message : String(err),
    });
    await sendButtonsMessage(
      ctx,
      copy("error.retry"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    return true;
  }
}

function buildConfirmationBody(order: OrderSnapshot, item: ItemRecord): string {
  const total = formatPrice(order.totalMinor, order.currency);
  const summary = copy("order.simple.confirmed", {
    code: order.orderCode,
    bar: order.bar.name,
    total,
  });
  const itemLine = `${truncate(item.name, 60)} • ${total}`;
  const fallback = [
    copy("fallback.pay", { num: "1" }),
    copy("fallback.orderMore", { num: "2" }),
    copy("fallback.mainMenu"),
    copy("fallback.prompt"),
  ];
  return [summary, itemLine, fallback.join("\n")].join("\n\n");
}

function buildPayOptions(
  order: OrderSnapshot,
): { ussd: string | null; telUri: string | null; instructions: string | null } {
  const amountMajor = Math.max(1, Math.round(order.totalMinor / 100));
  const momoCode = getEffectiveMomoCode(order.bar);
  if (momoCode) {
    const ussd = `*182*8*1*${momoCode}*${amountMajor}#`;
    const telUri = ussd.replace(/#/g, "%23");
    return {
      ussd,
      telUri: `tel:${telUri}`,
      instructions: order.bar.paymentInstructions,
    };
  }
  return {
    ussd: null,
    telUri: null,
    instructions: order.bar.paymentInstructions,
  };
}
