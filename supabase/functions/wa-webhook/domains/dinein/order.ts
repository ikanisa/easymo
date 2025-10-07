import type { RouterContext } from "../../types.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { DINE_IDS } from "./ids.ts";
import { copy } from "./copy.ts";
import { formatPrice, logFlowAction } from "./utils.ts";
import { openMenu } from "./menu.ts";

const PAY_EMOJI = "💸";

type ChatState = { key: string; data?: Record<string, unknown> };

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

export async function handleOrderMore(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "dine_order") return false;
  const order = state.data as OrderState | undefined;
  if (!order?.bar_id) return false;
  await logFlowAction(ctx, "order_more", state.key, { bar_id: order.bar_id });
  const menuState: ChatState = {
    key: "dine_items",
    data: {
      bar_id: order.bar_id,
      bar_name: order.bar_name,
      bar_slug: order.bar_slug ?? null,
      offset: 0,
      total_count: 0,
      item_ids: [],
      next_offset: null,
      prev_offset: null,
      can_manage: Boolean(order.can_manage),
    },
  };
  return await openMenu(ctx, menuState, { offset: 0 });
}

export async function handlePayOrder(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "dine_order") return false;
  const order = state.data as OrderState | undefined;
  if (!order) return false;
  await logFlowAction(ctx, "order_pay_prompt", state.key, {
    order_id: order.order_id,
  });

  const total = formatPrice(order.total_minor, order.currency);
  const lines: string[] = [];

  if (order.ussd_code) {
    lines.push(copy("order.simple.pay", {
      ussd: order.ussd_code,
      total,
    }));
    if (order.ussd_uri) {
      lines.push(`Tap: ${order.ussd_uri}`);
    }
  } else {
    lines.push(copy("order.simple.payUnavailable", { bar: order.bar_name }));
  }

  if (order.payment_instructions) {
    lines.push(order.payment_instructions);
  }

  const fallback = [
    copy("fallback.orderMore", { num: "1" }),
    copy("fallback.mainMenu"),
    copy("fallback.prompt"),
  ];
  lines.push("", fallback.join("\n"));

  await sendButtonsMessage(
    ctx,
    lines.filter(Boolean).join("\n"),
    [
      { id: DINE_IDS.ORDER_MORE, title: copy("buttons.orderMore") },
      ...homeOnly(),
    ],
    { emoji: PAY_EMOJI },
  );
  return true;
}
