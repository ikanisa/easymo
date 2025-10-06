import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { ADMIN_STATE, ensureAdmin, setAdminState } from "./state.ts";
import { maskPhone } from "../support.ts";
import { sendAdminList, sendAdminViewButton } from "./ui.ts";

export const ADMIN_ROW_IDS = {
  OPS_TRIPS: "ADMIN::OPS::TRIPS",
  OPS_BASKETS: "ADMIN::OPS::BASKETS",
  OPS_INSURANCE: "ADMIN::OPS::INSURANCE",
  OPS_VOUCHERS: "ADMIN::OPS::VOUCHERS",
  OPS_MARKETPLACE: "ADMIN::OPS::MARKETPLACE",
  OPS_WALLET: "ADMIN::OPS::WALLET",
  OPS_MOMO: "ADMIN::OPS::MOMO",
  GROW_PROMOTERS: "ADMIN::GROW::PROMOTERS",
  GROW_BROADCAST: "ADMIN::GROW::BROADCAST",
  GROW_TEMPLATES: "ADMIN::GROW::TEMPLATES",
  TRUST_REFERRALS: "ADMIN::TRUST::REFERRALS",
  TRUST_FREEZE: "ADMIN::TRUST::FREEZE",
  DIAG_MATCH: "ADMIN::DIAG::MATCH",
  DIAG_INSURANCE: "ADMIN::DIAG::INSURANCE",
  DIAG_HEALTH: "ADMIN::DIAG::HEALTH",
  DIAG_LOGS: "ADMIN::DIAG::LOGS",
  VOUCHERS_MENU_ISSUE: "ADMIN::VOUCHERS::MENU::ISSUE",
  VOUCHERS_MENU_REDEEM: "ADMIN::VOUCHERS::MENU::REDEEM",
  VOUCHERS_MENU_RECENT: "ADMIN::VOUCHERS::MENU::RECENT",
  VOUCHERS_RECENT_PREFIX: "ADMIN::VOUCHERS::RECENT::",
  BASKETS_QUEUE_PREFIX: "ADMIN::BASKETS::QUEUE::",
  BASKETS_DETAIL_APPROVE: "ADMIN::BASKETS::DETAIL::APPROVE",
  BASKETS_DETAIL_REVOKE: "ADMIN::BASKETS::DETAIL::REVOKE",
  BASKETS_DETAIL_SHARE: "ADMIN::BASKETS::DETAIL::SHARE",
  BASKETS_DETAIL_REGEN: "ADMIN::BASKETS::DETAIL::REGEN",
  BASKETS_DETAIL_CLOSE: "ADMIN::BASKETS::DETAIL::CLOSE",
  BASKETS_DETAIL_DM: "ADMIN::BASKETS::DETAIL::DM",
  BASKETS_CONFIRM_PREFIX: "ADMIN::BASKETS::CONFIRM::",
  INSURANCE_LEAD_PREFIX: "ADMIN::INSURANCE::LEAD::",
  INSURANCE_DETAIL_DM: "ADMIN::INSURANCE::DETAIL::DM",
  INSURANCE_DETAIL_REVIEW: "ADMIN::INSURANCE::DETAIL::REVIEW",
  INSURANCE_DETAIL_MORE: "ADMIN::INSURANCE::DETAIL::MORE",
  INSURANCE_MORE_REQUEST: "ADMIN::INSURANCE::MORE::REQUEST",
  INSURANCE_MORE_ASSIGN: "ADMIN::INSURANCE::MORE::ASSIGN",
  INSURANCE_MORE_EXPORT: "ADMIN::INSURANCE::MORE::EXPORT",
};

export async function openAdminHub(ctx: RouterContext): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.ENTRY);
  const body = `Admin hub — quick ops\n${maskPhone(ctx.from)}`;
  await sendAdminViewButton(ctx, {
    body,
    id: IDS.ADMIN_HUB_VIEW,
    emoji: "🛠️",
  });
}

export async function showAdminHubList(ctx: RouterContext): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.HUB_LIST, { back: ADMIN_STATE.ENTRY });
  await sendAdminList(
    ctx,
    {
      title: "Admin Hub",
      body: "Pick a tool. ← Back returns here.",
      sectionTitle: "Ops tools",
      rows: [
        { id: ADMIN_ROW_IDS.OPS_INSURANCE, title: "Insurance" },
        { id: ADMIN_ROW_IDS.OPS_BASKETS, title: "Baskets" },
        { id: ADMIN_ROW_IDS.OPS_VOUCHERS, title: "Vouchers" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🛠️" },
  );
}
