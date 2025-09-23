import type { RouterContext } from "../types.ts";
import { IDS } from "../wa/ids.ts";
import {
  handleSeeDrivers,
  handleSeePassengers,
} from "../flows/mobility/nearby.ts";
import {
  handleScheduleRole,
  startScheduleTrip,
} from "../flows/mobility/schedule.ts";
import { startMarketplace } from "../flows/marketplace.ts";
import { handleBasketConfirmButton, startBaskets } from "../flows/baskets.ts";
import { startInsurance } from "../flows/insurance/ocr.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { startWallet } from "../flows/wallet/home.ts";
import { showWalletEarn } from "../flows/wallet/earn.ts";
import { showWalletTransactions } from "../flows/wallet/transactions.ts";
import { showWalletRedeem } from "../flows/wallet/redeem.ts";
import { showWalletTop } from "../flows/wallet/top.ts";
import { openAdminHub } from "../flows/admin/hub.ts";
import { handleAdminQuickAction } from "../flows/admin/actions.ts";
import { sendText } from "../wa/client.ts";
import { queueNotification } from "../notify/sender.ts";

export async function handleButton(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = msg.interactive?.button_reply?.id;
  if (!id) return false;
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
    case IDS.BASKET_CLOSE_CONFIRM:
    case IDS.BASKET_CLOSE_CANCEL:
    case IDS.BASKET_LEAVE_CONFIRM:
    case IDS.BASKET_LEAVE_CANCEL:
      return await handleBasketConfirmButton(ctx, id, state);
    case IDS.ROLE_DRIVER:
    case IDS.ROLE_PASSENGER:
      return await handleScheduleRole(ctx, id);
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
    case IDS.ADMIN_TODAY:
    case IDS.ADMIN_ALERTS:
    case IDS.ADMIN_SETTINGS:
      await handleAdminQuickAction(ctx, id);
      return true;
    default:
      return false;
  }
}
