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
import { startInsurance } from "../domains/insurance/index.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
  sendMotorInsuranceBlockedMessage,
} from "../domains/insurance/gate.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { openAdminHub, showAdminHubList } from "../flows/admin/hub.ts";
import { handleAdminQuickAction } from "../flows/admin/actions.ts";
import { handleInsuranceButton } from "../flows/admin/insurance.ts";
import { homeOnly, sendButtonsMessage } from "../utils/reply.ts";
import { DINE_IDS } from "../domains/dinein/ids.ts";
import { DINE_STATE } from "../domains/dinein/state.ts";
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
  continueOnboardLocation,
  continueOnboardPayment,
  handleDeleteMenuConfirm,
  handleNumbersAddSubmit,
  handleNumbersRemoveSubmit,
  handlePublish,
  handleRemoveCategoriesConfirm,
  handleToggleAvailability,
  handleUploadDone,
  managerContextFromState,
  promptReviewEditField,
  showBarsEntry,
  showBarsMenu,
  showCurrentNumbers,
  showDeleteMenuConfirmation,
  showEditMenu,
  showManageOrders,
  showManagerEntry,
  showManagerMenu,
  showNumbersMenu,
  showOnboardContacts,
  showOnboardIdentity,
  showOnboardPublish,
  showRemoveCategoriesConfirmation,
  showReviewIntro,
  showReviewItemMenu,
  showUploadInstruction,
} from "../domains/dinein/manager.ts";

export async function handleButton(
  ctx: RouterContext,
  msg: WhatsAppInteractiveButtonMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = getButtonReplyId(msg);
  if (!id) return false;
  const managerCtx = managerContextFromState(state);
  const currentItemId = typeof state.data?.itemId === "string"
    ? state.data.itemId
    : null;
  const currentItemName = typeof state.data?.itemName === "string"
    ? state.data.itemName
    : "Item";
  const currentItemMenuId = typeof state.data?.itemMenuId === "string"
    ? state.data.itemMenuId
    : null;
  const currentAvailable = state.data?.itemAvailable === true;
  switch (id) {
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
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
      if (state.key === DINE_STATE.ONBOARD_LOCATION) {
        await continueOnboardLocation(ctx, state);
      } else if (state.key === DINE_STATE.ONBOARD_PAYMENT) {
        await continueOnboardPayment(ctx, state);
      } else {
        await continueOnboardIdentity(ctx, state);
      }
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
    case IDS.DINEIN_BARS_NUMBERS_MENU:
      await showNumbersMenu(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_NUMBERS_VIEW:
      await showCurrentNumbers(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_NUMBERS_ADD:
      await handleNumbersAddSubmit(ctx, state);
      return true;
    case IDS.DINEIN_BARS_NUMBERS_REMOVE:
      await handleNumbersRemoveSubmit(ctx, state);
      return true;
    case IDS.DINEIN_BARS_EDIT_MENU:
      await showEditMenu(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_EDIT_UPLOAD:
      await showUploadInstruction(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_EDIT_DELETE:
      await showDeleteMenuConfirmation(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_EDIT_REMOVE_CATEGORIES:
      await showRemoveCategoriesConfirmation(ctx, managerCtx);
      return true;
    case IDS.DINEIN_BARS_EDIT_CONFIRM_DELETE:
      await handleDeleteMenuConfirm(ctx, state);
      return true;
    case IDS.DINEIN_BARS_EDIT_CONFIRM_REMOVE_CATEGORIES:
      await handleRemoveCategoriesConfirm(ctx, state);
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
        { itemMenuId: currentItemMenuId },
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
        { itemMenuId: currentItemMenuId },
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
        { itemMenuId: currentItemMenuId },
      );
      return true;
    case IDS.DINEIN_BARS_REVIEW_EDIT_CATEGORY:
      if (!currentItemId) return false;
      await promptReviewEditField(
        ctx,
        managerCtx,
        currentItemId,
        currentItemName,
        "category",
        { itemMenuId: currentItemMenuId },
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
