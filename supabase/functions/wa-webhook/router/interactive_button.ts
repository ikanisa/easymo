import type { RouterContext, WhatsAppInteractiveButtonMessage } from "../types.ts";
import { getButtonReplyId } from "../utils/messages.ts";
import { IDS } from "../wa/ids.ts";
import {
  handleChangeVehicleRequest,
  handleSeeDrivers,
  handleSeePassengers,
} from "../domains/mobility/nearby.ts";
import {
  handleScheduleChangeVehicle,
  handleScheduleRefresh,
  handleScheduleRole,
  handleScheduleSkipDropoff,
  requestScheduleDropoff,
  startScheduleTrip,
} from "../domains/mobility/schedule.ts";
import {
  handleMarketplaceButton,
  startMarketplace,
} from "../domains/marketplace/index.ts";
import { startInsurance } from "../domains/insurance/index.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
  sendMotorInsuranceBlockedMessage,
} from "../domains/insurance/gate.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { startWallet } from "../domains/wallet/home.ts";
import {
  handleWalletShareDone,
  showWalletEarn,
} from "../domains/wallet/earn.ts";
import { showWalletTransactions } from "../domains/wallet/transactions.ts";
import {
  handleWalletRedeemConfirm,
  showWalletRedeem,
} from "../domains/wallet/redeem.ts";
import { showWalletTop } from "../domains/wallet/top.ts";
import { openAdminHub, showAdminHubList } from "../flows/admin/hub.ts";
import { handleAdminQuickAction } from "../flows/admin/actions.ts";
import { handleInsuranceButton } from "../flows/admin/insurance.ts";
import { sendButtonsMessage, buildButtons } from "../utils/reply.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { handleAINearbyPharmacies, handleAINearbyQuincailleries } from "../domains/ai-agents/index.ts";

export async function handleButton(
  ctx: RouterContext,
  msg: WhatsAppInteractiveButtonMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = getButtonReplyId(msg);
  if (!id) return false;
  if (id.startsWith("dinein_")) {
    await sendDineInDisabledNotice(ctx);
    return true;
  }
  switch (id) {
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
    case IDS.MARKETPLACE:
      return await startMarketplace(ctx, state);
    case IDS.MARKETPLACE_BROWSE:
    case IDS.MARKETPLACE_ADD:
    case IDS.MARKETPLACE_NEXT:
    case IDS.MARKETPLACE_PREV:
    case IDS.MARKETPLACE_REFRESH:
    case IDS.MARKETPLACE_SKIP:
    case IDS.MARKETPLACE_MENU:
      return await handleMarketplaceButton(ctx, state, id);
    case IDS.MOTOR_INSURANCE:
    case IDS.MOTOR_INSURANCE_UPLOAD: {
      const gate = await evaluateMotorInsuranceGate(ctx);
      if (!gate.allowed) {
        await recordMotorInsuranceHidden(ctx, gate, "command");
        await sendMotorInsuranceBlockedMessage(ctx);
        return true;
      }
      return await startInsurance(ctx, state);
    }
    case IDS.MOMO_QR:
      return await startMomoQr(ctx, state);
    case IDS.MOMO_QR_MY:
    case IDS.MOMO_QR_NUMBER:
    case IDS.MOMO_QR_CODE:
    case IDS.MOMO_QR_SKIP:
      return await handleMomoButton(ctx, id, state);
    case IDS.WALLET:
      return await startWallet(ctx, state);
    case IDS.WALLET_EARN:
      return await showWalletEarn(ctx);
    case IDS.WALLET_TRANSACTIONS:
      return await showWalletTransactions(ctx);
    case IDS.WALLET_REDEEM:
      return await showWalletRedeem(ctx);
    case IDS.WALLET_REDEEM_CONFIRM:
      return await handleWalletRedeemConfirm(ctx, state as any);
    case IDS.WALLET_TOP:
      return await showWalletTop(ctx);
    case IDS.WALLET_SHARE_DONE:
      return await handleWalletShareDone(ctx);
    case IDS.ROLE_DRIVER:
    case IDS.ROLE_PASSENGER:
      return await handleScheduleRole(ctx, id);
    case IDS.SCHEDULE_ADD_DROPOFF:
      return await requestScheduleDropoff(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_SKIP_DROPOFF:
      return await handleScheduleSkipDropoff(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_REFRESH_RESULTS:
      return await handleScheduleRefresh(ctx, (state.data ?? {}) as any);
    case IDS.MOBILITY_CHANGE_VEHICLE:
      if (
        state.key === "mobility_nearby_location" ||
        state.key === "mobility_nearby_select"
      ) {
        return await handleChangeVehicleRequest(ctx, state.data);
      }
      if (
        state.key === "schedule_location" ||
        state.key === "schedule_dropoff"
      ) {
        return await handleScheduleChangeVehicle(ctx, state.data);
      }
      return false;
    case IDS.ADMIN_HUB:
      await openAdminHub(ctx);
      return true;
    case IDS.ADMIN_HUB_VIEW:
      await showAdminHubList(ctx);
      return true;
    case IDS.ADMIN_TODAY:
    case IDS.ADMIN_ALERTS:
    case IDS.ADMIN_SETTINGS:
      await handleAdminQuickAction(ctx, id);
      return true;
    case IDS.ADMIN_INSURANCE_VIEW:
    case IDS.ADMIN_INSURANCE_DETAIL_VIEW:
    case IDS.ADMIN_INSURANCE_MORE_VIEW:
    case IDS.ADMIN_INSURANCE_DM_SUBMIT:
    case IDS.ADMIN_INSURANCE_REVIEW_SUBMIT:
    case IDS.ADMIN_INSURANCE_REQUEST_SUBMIT:
    case IDS.ADMIN_INSURANCE_ASSIGN_SUBMIT:
    case IDS.ADMIN_INSURANCE_EXPORT_SUBMIT:
      if (await handleInsuranceButton(ctx, id, state)) return true;
      return false;
    
    // Pharmacy buttons
    case "pharmacy_search_all":
      if (!ctx.profileId) return false;
      const pharmacyState = state.data as { location?: { lat: number; lng: number } };
      if (pharmacyState.location && isFeatureEnabled("agent.pharmacy")) {
        return await handleAINearbyPharmacies(ctx, pharmacyState.location, undefined);
      }
      return false;
    case "pharmacy_add_medicine":
      await sendButtonsMessage(ctx, 
        "💊 Type the medicine names you need, or share a photo of your prescription.",
        buildButtons({ id: IDS.BACK_HOME, title: "🏠 Cancel" })
      );
      return true;
    
    // Quincaillerie buttons
    case "quincaillerie_search_all":
      if (!ctx.profileId) return false;
      const quincaillerieState = state.data as { location?: { lat: number; lng: number } };
      if (quincaillerieState.location && isFeatureEnabled("agent.quincaillerie")) {
        return await handleAINearbyQuincailleries(ctx, quincaillerieState.location, undefined);
      }
      return false;
    case "quincaillerie_add_items":
      await sendButtonsMessage(ctx,
        "🔧 Type the item names you need, or share a photo of the items.",
        buildButtons({ id: IDS.BACK_HOME, title: "🏠 Cancel" })
      );
      return true;
    
    default:
      if (await handleMarketplaceButton(ctx, state, id)) return true;
      return false;
  }
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendButtonsMessage(
    ctx,
    "Dine-in workflows are handled outside WhatsApp. Please coordinate with your success manager.",
    buildButtons({ id: IDS.BACK_HOME, title: "🏠 Back" }),
    { emoji: "ℹ️" },
  );
}
