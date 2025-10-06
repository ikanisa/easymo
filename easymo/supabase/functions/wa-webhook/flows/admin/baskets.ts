import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { ADMIN_ROW_IDS } from "./hub.ts";
import { ADMIN_STATE, ensureAdmin, setAdminState } from "./state.ts";
import {
  sendAdminActionButton,
  sendAdminList,
  sendAdminViewButton,
} from "./ui.ts";

const MAX_QUEUE_ROWS = 9;

type AdminBasket = {
  id: string;
  title: string;
  status: string;
};

export async function showAdminBasketsEntry(
  ctx: RouterContext,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.BASKETS_ENTRY, {
    back: ADMIN_STATE.HUB_LIST,
  });
  await sendAdminViewButton(ctx, {
    body: "Baskets queue — review and manage shared baskets.",
    id: IDS.ADMIN_BASKETS_VIEW,
    emoji: "🧺",
  });
}

export async function showAdminBasketsQueue(
  ctx: RouterContext,
  baskets: AdminBasket[] = [],
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  const trimmed = baskets.slice(0, MAX_QUEUE_ROWS);
  const rows = trimmed.map((basket) => ({
    id: `${ADMIN_ROW_IDS.BASKETS_QUEUE_PREFIX}${basket.id}`,
    title: basket.title.slice(0, 24),
  }));
  if (!rows.length) {
    rows.push({
      id: `${ADMIN_ROW_IDS.BASKETS_QUEUE_PREFIX}NONE`,
      title: "No baskets queued",
    });
  }
  rows.push({ id: IDS.BACK_MENU, title: "← Back" });
  await setAdminState(ctx, ADMIN_STATE.BASKETS_LIST, {
    back: ADMIN_STATE.BASKETS_ENTRY,
    data: { baskets: trimmed },
  });
  await sendAdminList(
    ctx,
    {
      title: "Basket queue",
      body: "Pick a basket to review.",
      sectionTitle: "Pending",
      rows,
    },
    { emoji: "🧺" },
  );
}

export async function handleAdminBasketsRow(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (id.startsWith(ADMIN_ROW_IDS.BASKETS_QUEUE_PREFIX)) {
    const basketId = id.slice(ADMIN_ROW_IDS.BASKETS_QUEUE_PREFIX.length);
    if (basketId === "NONE") {
      await sendText(ctx.from, "No baskets available to review yet.");
      return true;
    }
    const basket = findBasketInState(state, basketId);
    await showBasketDetailEntry(ctx, basketId, basket?.title ?? "Basket");
    return true;
  }
  switch (id) {
    case ADMIN_ROW_IDS.BASKETS_DETAIL_APPROVE:
      await showBasketConfirm(
        ctx,
        "Approve basket for public listing?",
        IDS.ADMIN_BASKETS_APPROVE_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.BASKETS_DETAIL_REVOKE:
      await showBasketConfirm(
        ctx,
        "Revoke public listing for this basket?",
        IDS.ADMIN_BASKETS_REVOKE_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.BASKETS_DETAIL_SHARE:
      await showBasketConfirm(
        ctx,
        "Share the basket link with the requester?",
        IDS.ADMIN_BASKETS_SHARE_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.BASKETS_DETAIL_REGEN:
      await showBasketConfirm(
        ctx,
        "Regenerate the invite token after noting a reason?",
        IDS.ADMIN_BASKETS_REGEN_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.BASKETS_DETAIL_CLOSE:
      await showBasketConfirm(
        ctx,
        "Close the basket after logging a reason?",
        IDS.ADMIN_BASKETS_CLOSE_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.BASKETS_DETAIL_DM:
      await showBasketConfirm(
        ctx,
        "DM the basket creator to follow up?",
        IDS.ADMIN_BASKETS_DM_SUBMIT,
        state,
      );
      return true;
    default:
      return false;
  }
}

export async function showBasketDetailEntry(
  ctx: RouterContext,
  basketId: string,
  title: string,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.BASKETS_DETAIL, {
    back: ADMIN_STATE.BASKETS_LIST,
    data: { basketId, title },
  });
  await sendAdminViewButton(ctx, {
    body: `${title.slice(0, 24)} — manage basket actions.`,
    id: IDS.ADMIN_BASKETS_DETAIL_VIEW,
    emoji: "🧺",
  });
}

export async function showBasketDetailMenu(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  const basketTitle = typeof state.data?.title === "string"
    ? state.data.title.slice(0, 24)
    : "Basket";
  await setAdminState(ctx, ADMIN_STATE.BASKETS_DETAIL_MENU, {
    back: ADMIN_STATE.BASKETS_DETAIL,
    data: state.data ?? {},
  });
  await sendAdminList(
    ctx,
    {
      title: basketTitle,
      body: "Pick an admin action.",
      sectionTitle: "Actions",
      rows: [
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_APPROVE, title: "Approve public" },
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_REVOKE, title: "Revoke public" },
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_SHARE, title: "Share link" },
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_REGEN, title: "Regenerate token" },
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_CLOSE, title: "Close basket" },
        { id: ADMIN_ROW_IDS.BASKETS_DETAIL_DM, title: "DM creator" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🧺" },
  );
}

async function showBasketConfirm(
  ctx: RouterContext,
  body: string,
  buttonId: string,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.BASKETS_CONFIRM, {
    back: ADMIN_STATE.BASKETS_DETAIL_MENU,
    data: state.data ?? {},
  });
  await sendAdminActionButton(ctx, {
    body,
    id: buttonId,
    title: "Confirm",
    emoji: "✅",
  });
}

export async function hydrateAdminBaskets(
  _ctx: RouterContext,
): Promise<AdminBasket[]> {
  // Placeholder data — replace with Supabase query once available.
  return [
    { id: "demo-1", title: "Fuel collective", status: "pending" },
    { id: "demo-2", title: "Market coop", status: "open" },
  ];
}

export async function handleBasketButton(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  switch (id) {
    case IDS.ADMIN_BASKETS_VIEW:
      await showAdminBasketsQueue(ctx, await hydrateAdminBaskets(ctx));
      return true;
    case IDS.ADMIN_BASKETS_DETAIL_VIEW:
      await showBasketDetailMenu(ctx, state);
      return true;
    case IDS.ADMIN_BASKETS_APPROVE_SUBMIT:
      await sendText(ctx.from, "Basket approval flow coming soon.");
      return true;
    case IDS.ADMIN_BASKETS_REVOKE_SUBMIT:
      await sendText(ctx.from, "Basket revoke flow coming soon.");
      return true;
    case IDS.ADMIN_BASKETS_SHARE_SUBMIT:
      await sendText(ctx.from, "Basket share link coming soon.");
      return true;
    case IDS.ADMIN_BASKETS_REGEN_SUBMIT:
      await sendText(ctx.from, "Basket token regeneration coming soon.");
      return true;
    case IDS.ADMIN_BASKETS_CLOSE_SUBMIT:
      await sendText(ctx.from, "Basket close flow coming soon.");
      return true;
    case IDS.ADMIN_BASKETS_DM_SUBMIT:
      await sendText(ctx.from, "Basket DM flow coming soon.");
      return true;
    default:
      return false;
  }
}

function findBasketInState(
  state: ChatState,
  basketId: string,
): AdminBasket | null {
  const raw = state.data?.baskets;
  if (!Array.isArray(raw)) return null;
  const match = raw.find((item) => item?.id === basketId);
  return match ?? null;
}
