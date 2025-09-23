import type { RouterContext } from "../../types.ts";
import { sendButtons, sendList, sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { isAdminNumber } from "./auth.ts";
import { maskPhone } from "../support.ts";

export const ADMIN_ROW_IDS = {
  OPS_TRIPS: "ADMIN::OPS::TRIPS",
  OPS_BASKETS: "ADMIN::OPS::BASKETS",
  OPS_INSURANCE: "ADMIN::OPS::INSURANCE",
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
};

export async function openAdminHub(ctx: RouterContext): Promise<void> {
  const isAdmin = await isAdminNumber(ctx);
  if (!isAdmin) {
    await sendText(ctx.from, "Admin tools are restricted. Message support if this is unexpected.");
    return;
  }
  await sendButtons(ctx.from, `Admin Hub — Quick ops\n${maskPhone(ctx.from)}`, [
    { id: IDS.ADMIN_TODAY, title: "Today" },
    { id: IDS.ADMIN_ALERTS, title: "Alerts" },
    { id: IDS.ADMIN_SETTINGS, title: "Settings" },
  ]);
  await sendList(ctx.from, {
    title: "Admin Tools",
    body: "Pick a tool. Use Back to menu anytime.",
    sectionTitle: "Operations",
    rows: [
      { id: ADMIN_ROW_IDS.OPS_TRIPS, title: "Trips (live)" },
      { id: ADMIN_ROW_IDS.OPS_BASKETS, title: "Baskets" },
      { id: ADMIN_ROW_IDS.OPS_INSURANCE, title: "Insurance leads" },
      { id: ADMIN_ROW_IDS.OPS_MARKETPLACE, title: "Marketplace" },
      { id: ADMIN_ROW_IDS.OPS_WALLET, title: "Wallet/tokens" },
      { id: ADMIN_ROW_IDS.OPS_MOMO, title: "MoMo QR" },
    ],
  });
  await sendList(ctx.from, {
    title: "Admin Tools",
    body: "Growth & comms",
    sectionTitle: "Growth",
    rows: [
      { id: ADMIN_ROW_IDS.GROW_PROMOTERS, title: "Promoters (Top 9)" },
      { id: ADMIN_ROW_IDS.GROW_BROADCAST, title: "Broadcast" },
      { id: ADMIN_ROW_IDS.GROW_TEMPLATES, title: "Templates" },
    ],
  });
  await sendList(ctx.from, {
    title: "Admin Tools",
    body: "Trust & diagnostics",
    sectionTitle: "Trust",
    rows: [
      { id: ADMIN_ROW_IDS.TRUST_REFERRALS, title: "Referrals review" },
      { id: ADMIN_ROW_IDS.TRUST_FREEZE, title: "Freeze account" },
    ],
  });
  await sendList(ctx.from, {
    title: "Admin Tools",
    body: "Diagnostics",
    sectionTitle: "Diagnostics",
    rows: [
      { id: ADMIN_ROW_IDS.DIAG_MATCH, title: "Match diag" },
      { id: ADMIN_ROW_IDS.DIAG_INSURANCE, title: "Insurance diag" },
      { id: ADMIN_ROW_IDS.DIAG_HEALTH, title: "System health" },
      { id: ADMIN_ROW_IDS.DIAG_LOGS, title: "Logs (latest)" },
    ],
  });
}
