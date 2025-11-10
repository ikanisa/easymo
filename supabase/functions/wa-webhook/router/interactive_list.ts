import type {
  RouterContext,
  WhatsAppInteractiveListMessage,
} from "../types.ts";
import { getListReplyId } from "../utils/messages.ts";
// AI Agents Integration
import { handleAIAgentOptionSelection } from "../domains/ai-agents/index.ts";
import {
  handleNearbyResultSelection,
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  isVehicleOption,
} from "../domains/mobility/nearby.ts";
import {
  handleScheduleResultSelection,
  handleScheduleRole,
  handleScheduleVehicle,
  isScheduleResult,
  isScheduleRole,
  startScheduleTrip,
} from "../domains/mobility/schedule.ts";
import {
  handleMarketplaceButton,
  handleMarketplaceCategorySelection,
  handleMarketplaceResult,
  startMarketplace,
} from "../domains/marketplace/index.ts";
import { handleAddBusinessCategorySelection } from "../domains/marketplace/index.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { handleWalletEarnSelection } from "../domains/wallet/earn.ts";
import { handleWalletRedeemSelection } from "../domains/wallet/redeem.ts";
import { ADMIN_ROW_IDS, openAdminHub } from "../flows/admin/hub.ts";
import { handleAdminRow } from "../flows/admin/dispatcher.ts";
import { IDS } from "../wa/ids.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { startWallet, WALLET_STATE_HOME } from "../domains/wallet/home.ts";
import { showWalletEarn } from "../domains/wallet/earn.ts";
import { showWalletTransactions } from "../domains/wallet/transactions.ts";
import { showWalletRedeem } from "../domains/wallet/redeem.ts";
import { showWalletTop } from "../domains/wallet/top.ts";
import {
  handleInsuranceListSelection,
  startInsurance,
} from "../domains/insurance/index.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
  sendMotorInsuranceBlockedMessage,
} from "../domains/insurance/gate.ts";
import { homeOnly, sendButtonsMessage } from "../utils/reply.ts";
import { handleAdminBack } from "../flows/admin/navigation.ts";
import {
  handleBarRow as handleDineBarRow,
  openManagerPortal,
  sendMenuQr,
  startDineIn,
} from "../domains/dinein/browse.ts";
import { handleItemRow as handleDineItemRow } from "../domains/dinein/item.ts";
import { openMenu } from "../domains/dinein/menu.ts";
import {
  DINE_IDS,
  isBarRow as isDineBarRow,
  isItemRow as isDineItemRow,
  isMoreRow as isDineMoreRow,
  isOrderRow,
  isReviewItemRow,
  parseMoreOffset,
  parseOrderRowId,
  parseReviewItemId,
} from "../domains/dinein/ids.ts";
import {
  handleOrderRowSelection,
  managerContextFromState,
  promptAddNumber,
  promptRemoveNumber,
  showBarsEntry,
  showBarsMenu,
  showCurrentNumbers,
  showDeleteMenuConfirmation,
  showEditMenu,
  showManageOrders,
  showManagerEntry,
  showManagerMenu,
  showNumbersMenu,
  showOnboardIdentity,
  showRemoveCategoriesConfirmation,
  showReviewIntro,
  showReviewItemMenu,
  showReviewList,
  showUploadInstruction,
} from "../domains/dinein/manager.ts";
import { handleDineBack } from "../domains/dinein/navigation.ts";
import { copy } from "../domains/dinein/copy.ts";

export async function handleList(
  ctx: RouterContext,
  msg: WhatsAppInteractiveListMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = getListReplyId(msg);
  if (!id) return false;
  
  // Check if this is an AI agent option selection
  if (id.startsWith("agent_option_") && state.key === "ai_agent_selection") {
    return await handleAIAgentOptionSelection(ctx, state, id);
  }
  
  const managerCtx = managerContextFromState(state);
  if (id === IDS.DINEIN_BARS_VIEW_LIST) {
    await startDineIn(ctx, state);
    return true;
  }
  if (id === IDS.DINEIN_BARS_MANAGER_VIEW) {
    await showManagerMenu(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_MANAGE) {
    await showManagerEntry(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_ONBOARD) {
    await showOnboardIdentity(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_UPLOAD) {
    await showUploadInstruction(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_MANAGE_ORDERS) {
    await showManageOrders(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_MANAGE_ORDERS_NEXT) {
    const page = Number(state.data?.page ?? 1);
    await showManageOrders(ctx, managerCtx, { page: page + 1 });
    return true;
  }
  if (id === IDS.DINEIN_BARS_MANAGE_ORDERS_PREV) {
    const page = Number(state.data?.page ?? 1);
    await showManageOrders(ctx, managerCtx, { page: Math.max(1, page - 1) });
    return true;
  }
  if (id === IDS.DINEIN_BARS_NUMBERS_MENU) {
    await showNumbersMenu(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_NUMBERS_VIEW) {
    await showCurrentNumbers(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_NUMBERS_ADD) {
    await promptAddNumber(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_NUMBERS_REMOVE) {
    await promptRemoveNumber(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_EDIT_MENU) {
    await showEditMenu(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_EDIT_UPLOAD) {
    await showUploadInstruction(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_EDIT_DELETE) {
    await showDeleteMenuConfirmation(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_EDIT_REMOVE_CATEGORIES) {
    await showRemoveCategoriesConfirmation(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_REVIEW) {
    await showReviewIntro(ctx, managerCtx);
    return true;
  }
  if (id === IDS.DINEIN_BARS_REVIEW_NEXT_PAGE) {
    const page = Number(state.data?.page ?? 1);
    await showReviewList(ctx, managerCtx, { page: page + 1 });
    return true;
  }
  if (id === IDS.DINEIN_BARS_REVIEW_PREV_PAGE) {
    const page = Number(state.data?.page ?? 1);
    await showReviewList(ctx, managerCtx, { page: Math.max(1, page - 1) });
    return true;
  }
  if (id === IDS.DINEIN_BARS_REVIEW_VIEW_LIST) {
    await showReviewList(ctx, managerCtx);
    return true;
  }
  if (isReviewItemRow(id)) {
    const itemId = parseReviewItemId(id);
    await showReviewItemMenu(ctx, managerCtx, itemId, state);
    return true;
  }
  if (await handleHomeMenuSelection(ctx, id, state)) {
    return true;
  }
  if (isDineBarRow(id)) {
    return await handleDineBarRow(ctx, id);
  }
  if (isDineItemRow(id)) {
    return await handleDineItemRow(ctx, id, state);
  }
  if (isDineMoreRow(id)) {
    const offset = parseMoreOffset(id);
    return await openMenu(ctx, state, { offset });
  }
  if (isOrderRow(id)) {
    await handleOrderRowSelection(ctx, state, parseOrderRowId(id));
    return true;
  }
  if (id === IDS.BACK_HOME) {
    await sendHomeMenu(ctx);
    return true;
  }
  if (await handleInsuranceListSelection(ctx, state, id)) {
    return true;
  }
  if (state.key === "market_category" && id.startsWith("cat::")) {
    return await handleMarketplaceCategorySelection(ctx, id);
  }
  if (state.key === "market_add_category" && id.startsWith("cat::")) {
    return await handleAddBusinessCategorySelection(ctx, id, state);
  }
  if (
    id === IDS.MARKETPLACE_PREV || id === IDS.MARKETPLACE_NEXT ||
    id === IDS.MARKETPLACE_REFRESH || id === IDS.MARKETPLACE_ADD ||
    id === IDS.MARKETPLACE_BROWSE || id === IDS.MARKETPLACE_MENU
  ) {
    return await handleMarketplaceButton(ctx, state, id);
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
  if (await handleBasketButton(ctx, state, id)) {
    return true;
  }
  if (id === DINE_IDS.MANAGE_BAR) {
    return await openManagerPortal(ctx, state);
  }
  if (id === DINE_IDS.MENU_QR) {
    return await sendMenuQr(ctx, state);
  }
  if (await handleWalletEarnSelection(ctx, state as any, id)) {
    return true;
  }
  if (await handleWalletRedeemSelection(ctx, state as any, id)) {
    return true;
  }
  if (id === IDS.WALLET_EARN) {
    return await showWalletEarn(ctx);
  }
  if (id === IDS.WALLET_TRANSACTIONS) {
    return await showWalletTransactions(ctx);
  }
  if (id === IDS.WALLET_REDEEM) {
    return await showWalletRedeem(ctx);
  }
  if (id === IDS.WALLET_TOP) {
    return await showWalletTop(ctx);
  }
  if (id.startsWith("wallet_tx::")) {
    return await showWalletTransactions(ctx);
  }
  if (id.startsWith("wallet_top::")) {
    return await showWalletTop(ctx);
  }
  if (id === IDS.BACK_MENU) {
    return await handleBackMenu(ctx, state);
  }
  if (id.startsWith("ADMIN::")) {
    if (
      id === ADMIN_ROW_IDS.OPS_TRIPS ||
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
      return await handleAdminRow(ctx, id, state);
    }
  }
  if (id.startsWith("DINE_")) {
    await sendButtonsMessage(
      ctx,
      copy("error.expired"),
      [...homeOnly()],
      { emoji: "⚠️" },
    );
    await startDineIn(ctx, state, { skipResume: true });
    return true;
  }
  return false;
}

async function handleBackMenu(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (state.key?.startsWith("dine")) {
    if (await handleDineBack(ctx, state as any)) {
      return true;
    }
  }
  if (state.key?.startsWith("admin")) {
    if (await handleAdminBack(ctx, state)) {
      return true;
    }
  }
  if (state.key === WALLET_STATE_HOME) {
    await sendHomeMenu(ctx);
    return true;
  }
  if (state.key?.startsWith("wallet_")) {
    return await startWallet(ctx, state);
  }
  await sendHomeMenu(ctx);
  return true;
}

async function handleHomeMenuSelection(
  ctx: RouterContext,
  id: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const managerCtx = managerContextFromState(state);
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
    case IDS.MOTOR_INSURANCE: {
      const gate = await evaluateMotorInsuranceGate(ctx);
      console.info("insurance.gate", {
        allowed: gate.allowed,
        rule: gate.rule,
        country: gate.detectedCountry,
      });
      if (!gate.allowed) {
        await recordMotorInsuranceHidden(ctx, gate, "command");
        await sendMotorInsuranceBlockedMessage(ctx);
        return true;
      }
      return await startInsurance(ctx, state);
    }
    case IDS.MOMO_QR:
      return await startMomoQr(ctx, state);
    case IDS.HOME_MORE: {
      const page =
        state.key === "home_menu" && typeof state.data?.page === "number"
          ? Number(state.data.page)
          : 0;
      await sendHomeMenu(ctx, page + 1);
      return true;
    }
    case IDS.HOME_BACK: {
      const page =
        state.key === "home_menu" && typeof state.data?.page === "number"
          ? Number(state.data.page)
          : 0;
      await sendHomeMenu(ctx, Math.max(page - 1, 0));
      return true;
    }
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
      await showBarsEntry(ctx, managerCtx);
      return true;
    case IDS.ADMIN_HUB:
      await openAdminHub(ctx);
      return true;
    default:
      return false;
  }
}
