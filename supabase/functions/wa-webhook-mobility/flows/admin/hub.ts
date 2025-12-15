import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { ADMIN_STATE, ensureAdmin, setAdminState } from "./state.ts";
import { maskPhone } from "../support.ts";
import { sendAdminList, sendAdminViewButton } from "./ui.ts";

export const ADMIN_ROW_IDS = {
  OPS_TRIPS: "ADMIN::OPS::TRIPS",
  OPS_MARKETPLACE: "ADMIN::OPS::MARKETPLACE",
  OPS_WALLET: "ADMIN::OPS::WALLET",
  OPS_MOMO: "ADMIN::OPS::MOMO",
  TRUST_REFERRALS: "ADMIN::TRUST::REFERRALS",
  TRUST_FREEZE: "ADMIN::TRUST::FREEZE",
  DIAG_MATCH: "ADMIN::DIAG::MATCH",
  DIAG_HEALTH: "ADMIN::DIAG::HEALTH",
  DIAG_LOGS: "ADMIN::DIAG::LOGS",
  DIAG_MENU_RECONCILE: "ADMIN::DIAG::MENU_RECONCILE",
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
        { id: ADMIN_ROW_IDS.DIAG_MENU_RECONCILE, title: "Reconcile Menus ↔ Business" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🛠️" },
  );
}
