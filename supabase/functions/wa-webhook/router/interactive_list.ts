import type { RouterContext } from "../types.ts";
import {
  handleNearbyResultSelection,
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  isVehicleOption,
} from "../flows/mobility/nearby.ts";
import {
  handleScheduleResultSelection,
  handleScheduleRole,
  handleScheduleVehicle,
  isScheduleResult,
  isScheduleRole,
  startScheduleTrip,
} from "../flows/mobility/schedule.ts";
import { handleBasketListSelection, startBaskets } from "../flows/baskets.ts";
import { handleMarketplaceResult, startMarketplace } from "../flows/marketplace.ts";
import { handleWalletEarnSelection } from "../flows/wallet/earn.ts";
import { handleWalletRedeemSelection } from "../flows/wallet/redeem.ts";
import { ADMIN_ROW_IDS, openAdminHub } from "../flows/admin/hub.ts";
import { handleAdminRow } from "../flows/admin/dispatcher.ts";
import { IDS } from "../wa/ids.ts";
import { startInsurance } from "../flows/insurance/ocr.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { startWallet } from "../flows/wallet/home.ts";
import { showWalletEarn } from "../flows/wallet/earn.ts";
import { showWalletTransactions } from "../flows/wallet/transactions.ts";
import { showWalletRedeem } from "../flows/wallet/redeem.ts";
import { showWalletTop } from "../flows/wallet/top.ts";
import { queueNotification } from "../notify/sender.ts";
import { sendText } from "../wa/client.ts";

export async function handleList(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = msg.interactive?.list_reply?.id;
  if (!id) return false;
  if (await handleHomeMenuSelection(ctx, id, state)) {
    return true;
  }
  if (isVehicleOption(id) && state.key === "mobility_nearby_select") {
    return await handleVehicleSelection(ctx, (state.data ?? {}) as any, id);
  }
  if (state.key === "mobility_nearby_results") {
    return await handleNearbyResultSelection(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  if (isScheduleRole(id) && state.key === "schedule_role") {
    return await handleScheduleRole(ctx, id);
  }
  if (isVehicleOption(id) && state.key === "schedule_vehicle") {
    return await handleScheduleVehicle(ctx, (state.data ?? {}) as any, id);
  }
  if (isScheduleResult(id) && state.key === "schedule_results") {
    return await handleScheduleResultSelection(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  if (await handleBasketListSelection(ctx, id, state)) {
    return true;
  }
  if (await handleMarketplaceResult(ctx, state, id)) {
    return true;
  }
  if (await handleWalletEarnSelection(ctx, state as any, id)) {
    return true;
  }
  if (await handleWalletRedeemSelection(ctx, state as any, id)) {
    return true;
  }
  if (id.startsWith("ADMIN::")) {
    if (
      id === ADMIN_ROW_IDS.OPS_TRIPS || id === ADMIN_ROW_IDS.OPS_BASKETS ||
      id === ADMIN_ROW_IDS.OPS_INSURANCE ||
      id === ADMIN_ROW_IDS.OPS_MARKETPLACE || id === ADMIN_ROW_IDS.OPS_WALLET ||
      id === ADMIN_ROW_IDS.OPS_MOMO || id === ADMIN_ROW_IDS.GROW_PROMOTERS ||
      id === ADMIN_ROW_IDS.GROW_BROADCAST ||
      id === ADMIN_ROW_IDS.GROW_TEMPLATES ||
      id === ADMIN_ROW_IDS.TRUST_REFERRALS ||
      id === ADMIN_ROW_IDS.TRUST_FREEZE || id === ADMIN_ROW_IDS.DIAG_MATCH ||
      id === ADMIN_ROW_IDS.DIAG_INSURANCE || id === ADMIN_ROW_IDS.DIAG_HEALTH ||
      id === ADMIN_ROW_IDS.DIAG_LOGS
    ) {
      return await handleAdminRow(ctx, id);
    }
  }
  return false;
}

async function handleHomeMenuSelection(
  ctx: RouterContext,
  id: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  switch (id) {
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
    case IDS.MARKETPLACE:
      return await startMarketplace(ctx, state);
    case IDS.BASKETS:
      return await startBaskets(ctx, state);
    case IDS.MOTOR_INSURANCE:
      return await startInsurance(ctx, state);
    case IDS.MOMO_QR:
      return await startMomoQr(ctx, state);
    case IDS.MOMO_QR_MY:
    case IDS.MOMO_QR_NUMBER:
    case IDS.MOMO_QR_CODE:
      return await handleMomoButton(ctx, id, state);
    case IDS.WALLET:
      return await startWallet(ctx, state);
    case IDS.WALLET_EARN:
      return await showWalletEarn(ctx);
    case IDS.WALLET_TRANSACTIONS:
      return await showWalletTransactions(ctx);
    case IDS.WALLET_REDEEM:
      return await showWalletRedeem(ctx);
    case IDS.WALLET_TOP:
      return await showWalletTop(ctx);
    case IDS.DINEIN_BARS:
      await queueNotification(
        { to: ctx.from, flow: { flow_id: "flow.cust.bar_browser.v1" } },
        { type: "flow_launch" },
      );
      await sendText(ctx.from, "Launching dine-in flow…");
      return true;
    case IDS.ADMIN_HUB:
      await openAdminHub(ctx);
      return true;
    default:
      return false;
  }
}
