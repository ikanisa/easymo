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

const MAX_RECENT_VOUCHERS = 9;

type VoucherSummary = {
  id: string;
  code: string;
  status: string;
  amount?: number | null;
  currency?: string | null;
};

export async function showAdminVouchersEntry(
  ctx: RouterContext,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_ENTRY, {
    back: ADMIN_STATE.HUB_LIST,
  });
  await sendAdminViewButton(ctx, {
    body: "Vouchers — issue, redeem, and review recent codes.",
    id: IDS.ADMIN_VOUCHERS_VIEW,
    emoji: "🎟️",
  });
}

export async function showAdminVouchersMenu(
  ctx: RouterContext,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_LIST, {
    back: ADMIN_STATE.VOUCHERS_ENTRY,
  });
  await sendAdminList(
    ctx,
    {
      title: "Vouchers",
      body: "Pick an action. Issue, redeem, or view recent codes.",
      sectionTitle: "Voucher tools",
      rows: [
        { id: ADMIN_ROW_IDS.VOUCHERS_MENU_ISSUE, title: "Issue voucher" },
        { id: ADMIN_ROW_IDS.VOUCHERS_MENU_REDEEM, title: "Redeem voucher" },
        { id: ADMIN_ROW_IDS.VOUCHERS_MENU_RECENT, title: "Recent" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🎟️" },
  );
}

export async function handleAdminVoucherRow(
  ctx: RouterContext,
  id: string,
  _state: ChatState,
): Promise<boolean> {
  switch (id) {
    case ADMIN_ROW_IDS.VOUCHERS_MENU_ISSUE:
      await showVoucherIssueForm(ctx);
      return true;
    case ADMIN_ROW_IDS.VOUCHERS_MENU_REDEEM:
      await showVoucherRedeemForm(ctx);
      return true;
    case ADMIN_ROW_IDS.VOUCHERS_MENU_RECENT:
      await showVoucherRecentEntry(ctx);
      return true;
    default:
      if (id.startsWith(ADMIN_ROW_IDS.VOUCHERS_RECENT_PREFIX)) {
        await sendText(ctx.from, "Voucher detail view coming soon.");
        return true;
      }
      return false;
  }
}

async function showVoucherIssueForm(ctx: RouterContext): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_FORM, {
    back: ADMIN_STATE.VOUCHERS_LIST,
    data: { mode: "issue" },
  });
  await sendAdminActionButton(ctx, {
    body: "Issue a voucher. Confirm when ready to generate and send.",
    id: IDS.ADMIN_VOUCHERS_ISSUE_SUBMIT,
    title: "Generate & Send",
    emoji: "🎟️",
  });
}

async function showVoucherRedeemForm(ctx: RouterContext): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_FORM, {
    back: ADMIN_STATE.VOUCHERS_LIST,
    data: { mode: "redeem" },
  });
  await sendAdminActionButton(ctx, {
    body: "Redeem a voucher. Confirm after entering the code.",
    id: IDS.ADMIN_VOUCHERS_REDEEM_SUBMIT,
    title: "Verify",
    emoji: "✅",
  });
}

export async function showVoucherRecentEntry(
  ctx: RouterContext,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_RECENT_ENTRY, {
    back: ADMIN_STATE.VOUCHERS_LIST,
  });
  await sendAdminViewButton(ctx, {
    body: "Recent vouchers — latest 9 entries.",
    id: IDS.ADMIN_VOUCHERS_RECENT_VIEW,
    emoji: "🗂️",
  });
}

export async function showVoucherRecentList(
  ctx: RouterContext,
  vouchers: VoucherSummary[] = [],
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  const rows = vouchers.slice(0, MAX_RECENT_VOUCHERS).map((voucher) => ({
    id: `${ADMIN_ROW_IDS.VOUCHERS_RECENT_PREFIX}${voucher.id}`,
    title: voucherTitle(voucher),
  }));
  if (!rows.length) {
    rows.push({
      id: `${ADMIN_ROW_IDS.VOUCHERS_RECENT_PREFIX}NONE`,
      title: "No vouchers yet",
    });
  }
  rows.push({ id: IDS.BACK_MENU, title: "← Back" });
  await setAdminState(ctx, ADMIN_STATE.VOUCHERS_RECENT_LIST, {
    back: ADMIN_STATE.VOUCHERS_RECENT_ENTRY,
    data: { count: vouchers.length },
  });
  await sendAdminList(
    ctx,
    {
      title: "Recent vouchers",
      body: "Latest issued or redeemed vouchers.",
      sectionTitle: "Latest",
      rows,
    },
    { emoji: "🗂️" },
  );
}

function voucherTitle(voucher: VoucherSummary): string {
  const status = voucher.status ?? "status";
  const amount = typeof voucher.amount === "number" && voucher.currency
    ? `${voucher.currency}${voucher.amount}`
    : "";
  const suffix = amount ? ` • ${amount}` : "";
  return `${voucher.code} • ${status}${suffix}`.slice(0, 24);
}

export async function handleVoucherButton(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  switch (id) {
    case IDS.ADMIN_VOUCHERS_VIEW:
      await showAdminVouchersMenu(ctx);
      return true;
    case IDS.ADMIN_VOUCHERS_RECENT_VIEW:
      await showVoucherRecentList(ctx, await hydrateRecentVouchers(ctx));
      return true;
    case IDS.ADMIN_VOUCHERS_ISSUE_SUBMIT:
      await sendText(ctx.from, "Voucher issue flow coming soon.");
      return true;
    case IDS.ADMIN_VOUCHERS_REDEEM_SUBMIT:
      await sendText(ctx.from, "Voucher redeem flow coming soon.");
      return true;
    default:
      return false;
  }
}

export async function hydrateRecentVouchers(
  _ctx: RouterContext,
): Promise<VoucherSummary[]> {
  // Placeholder implementation. Integrate Supabase query once schema is finalised.
  return [];
}
