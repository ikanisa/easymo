import type { RouterContext } from "../types.ts";
import { IDS } from "../wa/ids.ts";
import {
  handleSeeDrivers,
  handleSeePassengers,
} from "../domains/mobility/nearby.ts";
import {
  handleScheduleRefresh,
  handleScheduleRole,
  requestScheduleDropoff,
  startScheduleTrip,
} from "../domains/mobility/schedule.ts";
import {
  handleMarketplaceButton,
  startMarketplace,
} from "../domains/marketplace/index.ts";
import { startInsurance } from "../domains/insurance/index.ts";
import {
  handleBasketButton,
  handleBasketConfirmButton,
  startBaskets,
} from "../flows/baskets.ts";
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
import { handleVoucherButton } from "../flows/admin/vouchers.ts";
import { handleBasketButton as handleAdminBasketButton } from "../flows/admin/baskets.ts";
import { handleInsuranceButton } from "../flows/admin/insurance.ts";
import { homeOnly, sendButtonsMessage } from "../utils/reply.ts";
import { DINE_IDS } from "../domains/dinein/ids.ts";
import {
  handleBarsPagingButton,
  openManagerPortal,
  sendMenuQr,
  startDineIn,
} from "../domains/dinein/browse.ts";
import { handleItemsPagingButton, openMenu } from "../domains/dinein/menu.ts";
import { handleOrderMore, handlePayOrder } from "../domains/dinein/order.ts";
import { copy } from "../domains/dinein/copy.ts";
import {
  continueOnboardContacts,
  continueOnboardIdentity,
  handleAddWhatsappSave,
  handlePublish,
  handleToggleAvailability,
  handleUploadDone,
  managerContextFromState,
  promptReviewEditField,
  showAddWhatsappPrompt,
  showBarsEntry,
  showBarsMenu,
  showManageOrders,
  showManagerEntry,
  showManagerMenu,
  showOnboardContacts,
  showOnboardIdentity,
  showOnboardPublish,
  showReviewEditOptions,
  showReviewIntro,
  showReviewItemMenu,
  showUploadInstruction,
} from "../domains/dinein/manager.ts";

export async function handleButton(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = msg.interactive?.button_reply?.id;
  if (!id) return false;
  const managerCtx = managerContextFromState(state);
  const currentItemId = typeof state.data?.itemId === "string"
    ? state.data.itemId
    : null;
  const currentItemName = typeof state.data?.itemName === "string"
    ? state.data.itemName
    : "Item";
  const currentAvailable = state.data?.itemAvailable === true;
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
    case IDS.BASKETS:
      return await startBaskets(ctx, state);
    case IDS.BASKET_CREATE:
    case IDS.BASKET_JOIN:
    case IDS.BASKET_MY:
    case IDS.BASKET_CREATE_PUBLIC:
    case IDS.BASKET_CREATE_PRIVATE:
    case IDS.BASKET_SHARE:
    case IDS.BASKET_QR:
    case IDS.BASKET_CLOSE:
    case IDS.BASKET_LEAVE:
    case IDS.BASKET_BACK:
    case IDS.BASKET_SKIP:
      if (await handleBasketButton(ctx, state, id)) return true;
      return false;
    case IDS.MOTOR_INSURANCE:
    case IDS.MOTOR_INSURANCE_UPLOAD:
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
    case IDS.WALLET_REDEEM_CONFIRM:
      return await handleWalletRedeemConfirm(ctx, state as any);
    case IDS.WALLET_TOP:
      return await showWalletTop(ctx);
    case IDS.WALLET_SHARE_DONE:
      return await handleWalletShareDone(ctx);
    case IDS.BASKET_CLOSE_CONFIRM:
    case IDS.BASKET_CLOSE_CANCEL:
    case IDS.BASKET_LEAVE_CONFIRM:
    case IDS.BASKET_LEAVE_CANCEL:
      return await handleBasketConfirmButton(ctx, id, state);
    case IDS.ROLE_DRIVER:
    case IDS.ROLE_PASSENGER:
      return await handleScheduleRole(ctx, id);
    case IDS.SCHEDULE_ADD_DROPOFF:
      return await requestScheduleDropoff(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_REFRESH_RESULTS:
      return await handleScheduleRefresh(ctx, (state.data ?? {}) as any);
    case IDS.DINEIN_BARS:
      await showBarsEntry(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_VIEW:
      await showBarsMenu(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_MANAGER_VIEW:
      await showManagerMenu(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_ONBOARD_CONTINUE:
      await continueOnboardIdentity(ctx, state);
      return true;
    case IDS.DINEIN_BARS_ONBOARD_CONTACTS_CONTINUE:
      await continueOnboardContacts(ctx, state);
      return true;
    case IDS.DINEIN_BARS_ONBOARD_UPLOAD_DONE:
      await handleUploadDone(ctx, state);
      return true;
    case IDS.DINEIN_BARS_ONBOARD_PUBLISH:
      await handlePublish(ctx);
      return true;
    case IDS.DINEIN_BARS_ADD_WHATSAPP:
      await handleAddWhatsappSave(ctx);
      return true;
    case IDS.DINEIN_BARS_REVIEW_EDIT:
      if (!currentItemId) return false;
      await showReviewEditOptions(ctx, managerCtx, {
        itemId: currentItemId,
        itemName: currentItemName,
      });
      return true;
    case IDS.DINEIN_BARS_REVIEW_TOGGLE:
      if (!currentItemId) return false;
      await handleToggleAvailability(
        ctx,
        managerCtx,
        currentItemId,
        currentAvailable,
        currentItemName,
      );
      return true;
    case IDS.DINEIN_BARS_REVIEW_EDIT_NAME:
      if (!currentItemId) return false;
      await promptReviewEditField(
        ctx,
        managerCtx,
        currentItemId,
        currentItemName,
        "name",
      );
      return true;
    case IDS.DINEIN_BARS_REVIEW_EDIT_PRICE:
      if (!currentItemId) return false;
      await promptReviewEditField(
        ctx,
        managerCtx,
        currentItemId,
        currentItemName,
        "price",
      );
      return true;
    case IDS.DINEIN_BARS_REVIEW_EDIT_DESCRIPTION:
      if (!currentItemId) return false;
      await promptReviewEditField(
        ctx,
        managerCtx,
        currentItemId,
        currentItemName,
        "description",
      );
      return true;
    case IDS.DINEIN_BARS_REVIEW_ITEM_MENU:
      if (!currentItemId) return false;
      await showReviewItemMenu(ctx, managerCtx, currentItemId, state);
      return true;
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
    case IDS.ADMIN_VOUCHERS_VIEW:
    case IDS.ADMIN_VOUCHERS_RECENT_VIEW:
    case IDS.ADMIN_VOUCHERS_ISSUE_SUBMIT:
    case IDS.ADMIN_VOUCHERS_REDEEM_SUBMIT:
      if (await handleVoucherButton(ctx, id)) return true;
      return false;
    case IDS.ADMIN_BASKETS_VIEW:
    case IDS.ADMIN_BASKETS_DETAIL_VIEW:
    case IDS.ADMIN_BASKETS_APPROVE_SUBMIT:
    case IDS.ADMIN_BASKETS_REVOKE_SUBMIT:
    case IDS.ADMIN_BASKETS_SHARE_SUBMIT:
    case IDS.ADMIN_BASKETS_REGEN_SUBMIT:
    case IDS.ADMIN_BASKETS_CLOSE_SUBMIT:
    case IDS.ADMIN_BASKETS_DM_SUBMIT:
      if (await handleAdminBasketButton(ctx, id, state)) return true;
      return false;
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
    default:
      if (await handleMarketplaceButton(ctx, state, id)) return true;
      return await handleDineButtons(ctx, id, state);
  }
}

async function handleDineButtons(
  ctx: RouterContext,
  id: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (id === DINE_IDS.BARS_NEXT || id === DINE_IDS.BARS_PREV) {
    return await handleBarsPagingButton(ctx, id, state);
  }
  if (id === DINE_IDS.ITEMS_NEXT || id === DINE_IDS.ITEMS_PREV) {
    return await handleItemsPagingButton(ctx, id, state);
  }
  if (id === DINE_IDS.MENU) {
    if (state.key === "dine_bar" || state.key === "dine_items") {
      return await openMenu(ctx, state);
    }
    return await startDineIn(ctx, state, { skipResume: true });
  }
  if (id === DINE_IDS.MENU_QR) {
    return await sendMenuQr(ctx, state);
  }
  if (id === DINE_IDS.MANAGE_BAR) {
    return await openManagerPortal(ctx, state);
  }
  if (id === DINE_IDS.ORDER_MORE) {
    return await handleOrderMore(ctx, state);
  }
  if (id === DINE_IDS.PAY_ORDER) {
    return await handlePayOrder(ctx, state);
  }
  if (id.startsWith("DINE_")) {
    await sendButtonsMessage(
      ctx,
      copy("error.expired"),
      [...homeOnly()],
      { emoji: "⚠️" },
    );
    await startDineIn(ctx, { key: "dine_home", data: {} }, {
      skipResume: true,
    });
    return true;
  }
  return false;
}
