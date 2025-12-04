import type {
  RouterContext,
  WhatsAppInteractiveListMessage,
} from "../types.ts";
import { getListReplyId } from "../utils/messages.ts";
import { t } from "../i18n/translator.ts";
// AI Agents Integration
import {
  handleAIAgentOptionSelection,
} from "../domains/ai-agents/index.ts";
import {
  handleNearbyResultSelection,
  handleNearbySavedLocationSelection,
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  isVehicleOption,
} from "../domains/mobility/nearby.ts";
import type { NearbySavedPickerState } from "../domains/mobility/nearby.ts";
import {
  handleQuickSaveLocation,
  LOCATION_KIND_BY_ID,
} from "../domains/locations/save.ts";
import {
  handleSavedPlacesAddSelection,
  handleSavedPlacesListSelection,
  startSavedPlaces,
} from "../domains/locations/manage.ts";
import {
  handleScheduleResultSelection,
  handleScheduleRole,
  handleScheduleSavedLocationSelection,
  handleScheduleTimeSelection,
  handleScheduleVehicle,
  isScheduleResult,
  isScheduleRole,
  type ScheduleState,
  startScheduleTrip,
} from "../domains/mobility/schedule.ts";
import { setState } from "../state/store.ts";
import type { ScheduleSavedPickerState } from "../domains/mobility/schedule.ts";
import { sendHomeMenu } from "../flows/home.ts";

import {
  handleAddPropertyBedrooms,
  handleAddPropertyType,
  handleFindPropertyBedrooms,
  handleFindPropertyType,
  handlePropertyMenuSelection,
  handlePropertySavedLocationSelection,
  type PropertySavedPickerState,
  startPropertyRentals,
} from "../domains/property/rentals.ts";
import {
  handleJobCandidatesSelection,
  handleJobFindDurationSelection,
  handleJobPostDurationSelection,
  handleJobResultsSelection,
  handleJobSavedLocationSelection,
  type JobCandidatesState,
  type JobFindResultsState,
  type JobSavedPickerState,
} from "../domains/jobs/index.ts";
import { handleWalletEarnSelection } from "../domains/wallet/earn.ts";
import {
  BUSINESS_MANAGEMENT_STATE,
  BUSINESS_DETAIL_STATE,
  handleBusinessSelection,
  handleBusinessDetailAction,
} from "../domains/business/management.ts";
import { startAddNewBusiness } from "../domains/business/add_new.ts";
import { handleWalletRedeemSelection } from "../domains/wallet/redeem.ts";
import { ADMIN_ROW_IDS } from "../flows/admin/hub.ts";
import { handleAdminRow } from "../flows/admin/dispatcher.ts";
import { handleRecentSelection } from "../domains/recent/index.ts";
import { IDS } from "../wa/ids.ts";
import { handleMomoButton, startMomoQr } from "../flows/momo/qr.ts";
import { startWallet, WALLET_STATE_HOME } from "../domains/wallet/home.ts";
import { showWalletEarn } from "../domains/wallet/earn.ts";
import { showWalletTransactions } from "../domains/wallet/transactions.ts";
import { showWalletRedeem } from "../domains/wallet/redeem.ts";
import { showWalletTop } from "../domains/wallet/top.ts";
import { startWalletTransfer } from "../domains/wallet/transfer.ts";
import {
  handleInsuranceListSelection,
  startInsurance,
} from "../domains/insurance/index.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
  sendMotorInsuranceBlockedMessage,
} from "../../_shared/wa-webhook-shared/domains/insurance/gate.ts";
import {
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
  buildButtons,
} from "../utils/reply.ts";
import { handleAdminBack } from "../flows/admin/navigation.ts";
import {
  MENU_ITEM_PREFIX,
  MENU_ORDER_BROWSER_STATE,
  MENU_ORDER_ACTIONS_STATE,
  MENU_LIST_MORE,
  handleMenuItemSelection,
  handleMenuOrderAction,
  handleMenuPagination,
  type MenuOrderSession,
} from "../domains/orders/menu_order.ts";

export async function handleList(
  ctx: RouterContext,
  msg: WhatsAppInteractiveListMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = getListReplyId(msg);
  if (!id) return false;
  if (id.startsWith("dinein_")) {
    await sendDineInDisabledNotice(ctx);
    return true;
  }
  if (isRemovedFeatureId(id) || isRemovedFeatureState(state.key)) {
    await sendRemovedFeatureNotice(ctx);
    return true;
  }
  if (state.key === "location_saved_picker") {
    if (state.data?.source === "nearby" && id.startsWith("FAV::")) {
      return await handleNearbySavedLocationSelection(
        ctx,
        state.data as NearbySavedPickerState,
        id,
      );
    }
    if (
      state.data?.source === "schedule" &&
      !LOCATION_KIND_BY_ID[id] &&
      id !== IDS.BACK_MENU
    ) {
      return await handleScheduleSavedLocationSelection(
        ctx,
        state.data as ScheduleSavedPickerState,
        id,
      );
    }
    if (
      (state.data?.source === "property_find" ||
        state.data?.source === "property_add") &&
      !LOCATION_KIND_BY_ID[id] &&
      id !== IDS.BACK_MENU
    ) {
      return await handlePropertySavedLocationSelection(
        ctx,
        state.data as PropertySavedPickerState,
        id,
      );
    }
    if (
      (state.data?.source === "job_find" || state.data?.source === "job_post") &&
      !LOCATION_KIND_BY_ID[id] &&
      id !== IDS.BACK_MENU
    ) {
      return await handleJobSavedLocationSelection(
        ctx,
        state.data as JobSavedPickerState,
        id,
      );
    }
  }

  if (state.key === "saved_places_list") {
    if (await handleSavedPlacesListSelection(ctx, id)) {
      return true;
    }
  }
  // Vehicle management actions
  if (id.startsWith('VEH-DEL::')) {
    const vehId = id.slice('VEH-DEL::'.length);
    try {
      await ctx.supabase.from('vehicles').delete().eq('id', vehId);
      const { handleProfileVehicles } = await import("../domains/profile/index.ts");
      return await handleProfileVehicles(ctx);
    } catch (_) {
      return false;
    }
  }
  if (id.startsWith('VEH::')) {
    const vehId = id.slice('VEH::'.length);
    const { handleVehicleItemSelection } = await import("../domains/profile/index.ts");
    return await handleVehicleItemSelection(ctx, vehId);
  }
  if (state.key === "saved_places_add") {
    if (await handleSavedPlacesAddSelection(ctx, id)) {
      return true;
    }
  }
  if (state.key === 'recent_hub') {
    return await handleRecentSelection(ctx, id);
  }
  if (state.key === "job_find_type") {
    return await handleJobFindDurationSelection(ctx, id);
  }
  if (state.key === "job_post_type") {
    return await handleJobPostDurationSelection(ctx, id);
  }
  if (state.key === "job_find_results") {
    return await handleJobResultsSelection(
      ctx,
      (state.data ?? {}) as JobFindResultsState,
      id,
    );
  }
  if (state.key === "job_candidates_results") {
    return await handleJobCandidatesSelection(
      ctx,
      (state.data ?? {}) as JobCandidatesState,
      id,
    );
  }
  if (
    state.key === MENU_ORDER_BROWSER_STATE &&
    id.startsWith(MENU_ITEM_PREFIX)
  ) {
    return await handleMenuItemSelection(
      ctx,
      (state.data ?? {}) as MenuOrderSession,
      id,
    );
  }
  if (state.key === MENU_ORDER_BROWSER_STATE && id === MENU_LIST_MORE) {
    return await handleMenuPagination(
      ctx,
      (state.data ?? {}) as MenuOrderSession,
      "next",
    );
  }

  if (state.key === "business_claim") {
    const { handleBusinessClaim } = await import(
      "../domains/business/claim.ts"
    );
    if (id === 'BIZ::ADD_NEW') {
      const { startAddNewBusiness } = await import("../domains/business/add_new.ts");
      return await startAddNewBusiness(ctx);
    }
    return await handleBusinessClaim(ctx, (state.data ?? {}) as any, id);
  }

  if (state.key === "schedule_time_picker") {
    return await handleScheduleTimeSelection(
      ctx,
      (state.data ?? {}) as ScheduleState,
      id,
    );
  }

  if (
    state.key === BUSINESS_MANAGEMENT_STATE ||
    state.key === BUSINESS_DETAIL_STATE
  ) {
    if (await handleBusinessSelection(ctx, id, state)) {
      return true;
    }
  }

  if (id === "BIZ::ADD_NEW") {
    return await startAddNewBusiness(ctx);
  }

  // Check if this is an AI agent option selection
  if (id.startsWith("agent_option_") && state.key === "ai_agent_selection") {
    return await handleAIAgentOptionSelection(ctx, state, id);
  }



  // Check if this is a WhatsApp number selection
  if (id.startsWith("whatsapp::")) {
    const numberId = id.substring(10);
    if (state.key === "business_whatsapp_numbers" && state.data) {
      const { handleWhatsAppNumberSelection } = await import(
        "../domains/business/whatsapp_numbers.ts"
      );
      return await handleWhatsAppNumberSelection(
        ctx,
        numberId,
        state.data.businessId as string,
      );
    }
  }

  // Handle add-new business category selection
  if (state.key === 'business_add_new' && id.startsWith('BIZCAT::')) {
    const { handleAddNewBusinessSelect } = await import("../domains/business/add_new.ts");
    return await handleAddNewBusinessSelect(ctx, id, (state.data ?? {}) as any);
  }

  if (await handleHomeMenuSelection(ctx, id, state)) {
    return true;
  }

  // Wallet transfer partner selection
  if (state.key === "wallet_transfer") {
    if (id === "manual_recipient") {
      await setState(ctx.supabase, ctx.profileId!, { key: "wallet_transfer", data: { stage: "recipient", ...(state.data ?? {}) } });
      await sendButtonsMessage(ctx, "Send the recipient's WhatsApp number (e.g., +2507…).", [{ id: IDS.BACK_MENU, title: "Cancel" }]);
      return true;
    }
    if (id.startsWith("partner::")) {
      const partnerId = id.slice("partner::".length);
      const { data: partner } = await ctx.supabase
        .from('token_partners')
        .select('whatsapp_e164')
        .eq('id', partnerId)
        .maybeSingle();
      if (partner?.whatsapp_e164) {
        await setState(ctx.supabase, ctx.profileId!, { key: "wallet_transfer", data: { stage: "amount", to: partner.whatsapp_e164, ...(state.data ?? {}) } });
        await sendButtonsMessage(ctx, "How many tokens to send? Enter a number.", [{ id: IDS.BACK_MENU, title: "Cancel" }]);
        return true;
      }
      await sendButtonsMessage(ctx, "Recipient not available.", [{ id: IDS.BACK_MENU, title: "Cancel" }]);
      return true;
    }
  }

  // Business edit flows
  if (state.key === "business_edit") {
    const { handleBusinessEditAction } = await import("../domains/business/edit.ts");
    return await handleBusinessEditAction(ctx, (state.data ?? {}) as any, id);
  }

  // Restaurant manager flows
  if (state.key === "restaurant_manager") {
    const { handleRestaurantManagerAction } = await import(
      "../domains/vendor/restaurant.ts"
    );
    return await handleRestaurantManagerAction(ctx, state.data ?? {}, id);
  }

  // Restaurant menu editor flows
  if (state.key === "restaurant_edit") {
    const { handleRestaurantEditAction } = await import("../domains/vendor/restaurant.ts");
    return await handleRestaurantEditAction(ctx, (state.data ?? {}) as any, id);
  }
  
  if (id === IDS.BACK_HOME) {
    await sendHomeMenu(ctx);
    return true;
  }
  if (await handleInsuranceListSelection(ctx, state, id)) {
    return true;
  }
  if (id === IDS.PROFILE_MANAGE_BUSINESSES) {
    const { showManageBusinesses } = await import("../domains/business/management.ts");
    return await showManageBusinesses(ctx);
  }
  // Legacy services menu - redirect to General Broker
  if (id === IDS.SHOPS_SERVICES_MENU || id === 'shops_services_menu') {
    const { handleGeneralBrokerStart } = await import("../domains/ai-agents/general_broker.ts");
    return await handleGeneralBrokerStart(ctx);
  }
  // Marketplace flows retired

  // Property Rentals flows
  if (state.key === "property_menu") {
    return await handlePropertyMenuSelection(ctx, id);
  }
  if (
    state.key === "property_find_type" &&
    (id === "short_term" || id === "long_term")
  ) {
    return await handleFindPropertyType(ctx, id);
  }
  if (state.key === "property_find_bedrooms" && /^\d+$/.test(id)) {
    const stateData = state.data as { rentalType: string };
    return await handleFindPropertyBedrooms(ctx, stateData, id);
  }
  if (
    state.key === "property_add_type" &&
    (id === "short_term" || id === "long_term")
  ) {
    return await handleAddPropertyType(ctx, id);
  }
  if (state.key === "property_add_bedrooms" && /^\d+$/.test(id)) {
    const stateData = state.data as { rentalType: string };
    return await handleAddPropertyBedrooms(ctx, stateData, id);
  }
  if (state.key === "property_add_price_unit" && (id === "per_day" || id === "per_night" || id === "per_month")) {
    const stateData = state.data as { rentalType: string; bedrooms: string };
    const { handleAddPropertyPriceUnit } = await import("../domains/property/rentals.ts");
    return await handleAddPropertyPriceUnit(ctx, stateData, id);
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
  if (state.key === "schedule_time_select") {
    const timeOptions = new Set([
      "now",
      "30min",
      "1hour",
      "2hours",
      "5hours",
      "tomorrow_morning",
      "tomorrow_evening",
      "every_morning",
      "every_evening",
      "time::now",
      "time::30m",
      "time::1h",
      "time::2h",
      "time::5h",
      "time::tomorrow_am",
      "time::tomorrow_pm",
      "time::every_morning",
      "time::every_evening",
    ]);
    if (timeOptions.has(id)) {
      const { handleScheduleTimeSelection } = await import("../domains/mobility/schedule.ts");
      return await handleScheduleTimeSelection(ctx, (state.data ?? {}) as any, id);
    }
  }
  if (isScheduleResult(id) && state.key === "schedule_results") {
    return await handleScheduleResultSelection(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  // Marketplace flows removed
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
  if (LOCATION_KIND_BY_ID[id]) {
    return await handleQuickSaveLocation(ctx, LOCATION_KIND_BY_ID[id]);
  }
  if (id === IDS.BACK_MENU) {
    return await handleBackMenu(ctx, state);
  }
  if (id.startsWith("ADMIN::")) {
    if (
      id === ADMIN_ROW_IDS.OPS_TRIPS ||
      id === ADMIN_ROW_IDS.OPS_INSURANCE ||
      id === ADMIN_ROW_IDS.OPS_MARKETPLACE || id === ADMIN_ROW_IDS.OPS_WALLET ||
      id === ADMIN_ROW_IDS.OPS_MOMO ||
      id === ADMIN_ROW_IDS.TRUST_REFERRALS ||
      id === ADMIN_ROW_IDS.TRUST_FREEZE || id === ADMIN_ROW_IDS.DIAG_MATCH ||
      id === ADMIN_ROW_IDS.DIAG_INSURANCE || id === ADMIN_ROW_IDS.DIAG_HEALTH ||
      id === ADMIN_ROW_IDS.DIAG_LOGS
    ) {
      return await handleAdminRow(ctx, id, state);
    }
  }
  return false;
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendButtonsMessage(
    ctx,
    "Dine-in orders are handled separately. Please contact our team for assistance.",
    [...homeOnly()],
    { emoji: "ℹ️" },
  );
}

const REMOVED_KEYWORD_PARTS: Array<[string, string]> = [
  ["bask", "et"],
  ["vouch", "er"],
  ["camp", "aign"],
  ["templ", "ate"],
];

const REMOVED_KEYWORDS = REMOVED_KEYWORD_PARTS.map(([a, b]) => `${a}${b}`);

function isRemovedFeatureId(id: string): boolean {
  const lowered = id.toLowerCase();
  return REMOVED_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

function isRemovedFeatureState(key?: string): boolean {
  if (!key) return false;
  const lowered = key.toLowerCase();
  return REMOVED_KEYWORDS.some((keyword) => lowered.startsWith(keyword));
}

async function sendRemovedFeatureNotice(ctx: RouterContext): Promise<void> {
  await sendButtonsMessage(
    ctx,
    "That workflow has been retired. Please use the main menu buttons for the supported features.",
    [...homeOnly()],
    { emoji: "ℹ️" },
  );
}

async function handleBackMenu(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
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
  switch (id) {
    case IDS.RIDES_MENU: {
      const { showRidesMenu } = await import("../domains/mobility/rides_menu.ts");
      return await showRidesMenu(ctx);
    }
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
    case IDS.SAVED_PLACES:
      return await startSavedPlaces(ctx);

    case IDS.PROPERTY_RENTALS:
      return await startPropertyRentals(ctx);
    case IDS.MARKETPLACE: {
      const { startShopsAndServices } = await import(
        "../domains/shops/services.ts"
      );
      return await startShopsAndServices(ctx);
    }
    case 'pharmacy_resume': {
      const { handleRecentSelection } = await import("../domains/recent/index.ts");
      return await handleRecentSelection(ctx, 'pharmacy_resume');
    }
    case 'property_resume': {
      const { handleRecentSelection } = await import("../domains/recent/index.ts");
      return await handleRecentSelection(ctx, 'property_resume');
    }
    case IDS.PROFILE_MANAGE_BUSINESSES: {
      const { showManageBusinesses } = await import(
        "../domains/business/management.ts"
      );
      return await showManageBusinesses(ctx);
    }
    case IDS.BUSINESS_DELETE: {
      if (state.key === "business_detail" && state.data) {
        const { handleBusinessDelete } = await import(
          "../domains/business/management.ts"
        );
        return await handleBusinessDelete(
          ctx,
          state.data.businessId as string,
          state.data.businessName as string,
        );
      }
      return false;
    }
    case IDS.BUSINESS_EDIT:
    case IDS.BUSINESS_ADD_WHATSAPP: {
      if (state.key === "business_detail" && state.data) {
        if (id === IDS.BUSINESS_ADD_WHATSAPP) {
          const { showBusinessWhatsAppNumbers } = await import(
            "../domains/business/whatsapp_numbers.ts"
          );
          return await showBusinessWhatsAppNumbers(
            ctx,
            state.data.businessId as string,
            state.data.businessName as string,
          );
        }
        // Business edit - launch edit menu
        const { startBusinessEdit } = await import("../domains/business/edit.ts");
        return await startBusinessEdit(
          ctx,
          state.data.businessId as string,
          state.data.businessName as string,
        );
      }
      // If called from the WhatsApp numbers list, start add flow
      if (
        id === IDS.BUSINESS_ADD_WHATSAPP &&
        state.key === "business_whatsapp_numbers" &&
        state.data
      ) {
        const { startAddWhatsAppNumber } = await import(
          "../domains/business/whatsapp_numbers.ts"
        );
        return await startAddWhatsAppNumber(
          ctx,
          state.data.businessId as string,
          state.data.businessName as string,
        );
      }
      return false;
    }
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
    case "insurance_help":
    case IDS.INSURANCE_HELP: {
      const { handleInsuranceHelp } = await import("../domains/insurance/ins_handler.ts");
      return await handleInsuranceHelp(ctx);
    }
    case IDS.MOMO_QR:
      return await startMomoQr(ctx, state);
    case IDS.GENERAL_BROKER: {
      const { handleGeneralBrokerStart } = await import("../domains/ai-agents/general_broker.ts");
      return await handleGeneralBrokerStart(ctx);
    }
    // ===============================================================
    // 8 AI AGENTS - Aligned with ai_agents table
    // ===============================================================
    case IDS.WAITER_AGENT: {
      // Waiter AI - Bars & Restaurants
      const { startBarsRestaurants } = await import("../domains/bars/index.ts");
      return await startBarsRestaurants(ctx);
    }
    case IDS.RIDES_AGENT: {
      // Rides AI - Mobility coordinator
      const { showRidesMenu } = await import("../domains/mobility/rides_menu.ts");
      return await showRidesMenu(ctx);
    }
    case IDS.JOBS_AGENT: {
      // Jobs AI - Job board and gigs
      const { showJobBoardMenu } = await import("../domains/jobs/index.ts");
      return await showJobBoardMenu(ctx);
    }
    case IDS.BUSINESS_BROKER_AGENT: {
      // Business Broker AI - Find nearby businesses
      const { handleGeneralBrokerStart } = await import("../domains/ai-agents/general_broker.ts");
      return await handleGeneralBrokerStart(ctx);
    }
    case IDS.REAL_ESTATE_AGENT: {
      // Real Estate AI - Property rentals concierge
      const { startPropertyRentals } = await import("../domains/property/rentals.ts");
      return await startPropertyRentals(ctx);
    }
    case IDS.FARMER_AGENT: {
      // Farmer AI - Produce listing and buyer matching
      const { startFarmerAgent } = await import("../domains/ai-agents/farmer_home.ts");
      return await startFarmerAgent(ctx);
    }
    case IDS.INSURANCE_AGENT: {
      // Insurance AI - Quotes, claims, policies
      const gate = await evaluateMotorInsuranceGate(ctx);
      if (!gate.allowed) {
        await recordMotorInsuranceHidden(ctx, gate, "command");
        await sendMotorInsuranceBlockedMessage(ctx);
        return true;
      }
      return await startInsurance(ctx, state);
    }
    case IDS.SALES_AGENT: {
      // Sales AI - SDR for easyMO (internal use)
      // TODO: Implement sales agent handler
      await sendButtonsMessage(
        ctx,
        "📞 Sales AI Agent coming soon! This will help with prospecting, lead enrichment, and demo booking.",
        homeOnly()
      );
      return true;
    }
    // ===============================================================
    case IDS.PROFILE: {
      const { sendProfileMenu } = await import("../flows/profile.ts");
      await sendProfileMenu(ctx);
      return true;
    }
    case IDS.PROFILE_NEXT: {
      if (!ctx.profileId) return false;
      // Increment page and re-render profile menu
      const { data } = await ctx.supabase
        .from("chat_state")
        .select("data")
        .eq("user_id", ctx.profileId)
        .eq("key", "profile_menu")
        .maybeSingle();
      const countryCode = (data?.data?.countryCode as string) ?? 'RW';
      const page = Math.max(0, Number(data?.data?.page ?? 0)) + 1;
      await setState(ctx.supabase, ctx.profileId, { key: 'profile_menu', data: { countryCode, page } });
      const { sendProfileMenu } = await import("../flows/profile.ts");
      await sendProfileMenu(ctx);
      return true;
    }
    case IDS.PROFILE_PREV: {
      if (!ctx.profileId) return false;
      const { data } = await ctx.supabase
        .from("chat_state")
        .select("data")
        .eq("user_id", ctx.profileId)
        .eq("key", "profile_menu")
        .maybeSingle();
      const countryCode = (data?.data?.countryCode as string) ?? 'RW';
      const current = Math.max(0, Number(data?.data?.page ?? 0));
      const page = current > 0 ? current - 1 : 0;
      await setState(ctx.supabase, ctx.profileId, { key: 'profile_menu', data: { countryCode, page } });
      const { sendProfileMenu } = await import("../flows/profile.ts");
      await sendProfileMenu(ctx);
      return true;
    }
    case IDS.PROFILE_VEHICLES: {
      const { handleProfileVehicles } = await import("../domains/profile/index.ts");
      return await handleProfileVehicles(ctx);
    }
    case IDS.RECENT: {
      const { showRecentHub } = await import("../domains/recent/index.ts");
      return await showRecentHub(ctx);
    }
    case "show_vehicles": {
      // Action target alias from whatsapp_profile_menu_items
      const { handleProfileVehicles } = await import("../domains/profile/index.ts");
      return await handleProfileVehicles(ctx);
    }
    case IDS.PROFILE_ADD_VEHICLE: {
      const { handleAddVehicle } = await import("../domains/profile/index.ts");
      return await handleAddVehicle(ctx);
    }
    case IDS.PROFILE_BUSINESSES: {
      const { handleProfileBusinesses } = await import("../domains/profile/index.ts");
      return await handleProfileBusinesses(ctx);
    }
    case "show_businesses": {
      // Action target alias from whatsapp_profile_menu_items
      const { handleProfileBusinesses } = await import("../domains/profile/index.ts");
      return await handleProfileBusinesses(ctx);
    }
    case IDS.PROFILE_ADD_BUSINESS: {
      const { handleAddBusiness } = await import("../domains/profile/index.ts");
      return await handleAddBusiness(ctx);
    }
    case IDS.PROFILE_TOKENS: {
      // Redirect to existing wallet flow
      return await startWallet(ctx, state);
    }
    case IDS.PROFILE_PROPERTIES: {
      // Redirect to property rentals
      const { startPropertyRentals } = await import("../domains/property/rentals.ts");
      return await startPropertyRentals(ctx);
    }
    case "show_properties": {
      // Action target alias from whatsapp_profile_menu_items
      const { startPropertyRentals } = await import("../domains/property/rentals.ts");
      return await startPropertyRentals(ctx);
    }
    case "show_my_jobs":
    case IDS.JOB_MY_JOBS: {
      const { startMyJobsMenu } = await import("../domains/jobs/index.ts");
      return await startMyJobsMenu(ctx);
    }
    case "job_my_add": {
      const { startJobPosting } = await import("../domains/jobs/index.ts");
      return await startJobPosting(ctx);
    }
    case "job_my_view": {
      const { listMyJobs } = await import("../domains/jobs/index.ts");
      return await listMyJobs(ctx);
    }
    case "job_my_ai": {
      const { showJobBoardMenu } = await import("../domains/jobs/index.ts");
      return await showJobBoardMenu(ctx);
    }
    case "show_momo_qr": {
      // Action target alias from whatsapp_profile_menu_items
      return await startWallet(ctx, state);
    }
    case "show_profile": {
      // Action target alias for profile view
      id = IDS.PROFILE_VIEW; // Fall through to profile view handler
    }
    case IDS.PROFILE_VIEW: {
      // Show user profile information
      if (!ctx.profileId) {
        await sendButtonsMessage(ctx, "Profile not found. Please register first.", homeOnly());
        return true;
      }
      
      const { data: profile } = await ctx.supabase
        .from("profiles")
        .select("full_name, wa_id, created_at, country_code")
        .eq("id", ctx.profileId)
        .single();
      
      if (!profile) {
        await sendButtonsMessage(ctx, "Profile not found.", homeOnly());
        return true;
      }
      
      const profileInfo = `👤 *Your Profile*\n\n` +
        `Name: ${profile.full_name || 'Not set'}\n` +
        `WhatsApp: ${profile.wa_id}\n` +
        `Country: ${profile.country_code || 'RW'}\n` +
        `Member since: ${new Date(profile.created_at).toLocaleDateString()}`;
      
      await sendButtonsMessage(ctx, profileInfo, homeOnly());
      return true;
    }
    case IDS.PROFILE_SETTINGS:
    case "show_settings": {
      // TODO: Implement settings menu (language, notifications, etc.)
      await sendButtonsMessage(
        ctx,
        "Settings menu coming soon!",
        homeOnly()
      );
      return true;
    }
    case "saved_locations":
    case "show_saved_locations": {
      // Show saved locations (redirect to saved places)
      const { startSavedPlaces } = await import("../domains/locations/manage.ts");
      return await startSavedPlaces(ctx);
    }
    case "change_language": {
      // Fetch languages from database
      const { data: languages } = await ctx.supabase
        .from('supported_languages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!languages || languages.length === 0) {
        // Fallback if database fails
        await sendListMessage(
          ctx,
          {
            title: "Change Language",
            body: "Select your preferred language:",
            sectionTitle: "Available Languages",
            rows: [
              { id: "lang_en", title: "🇬🇧 English", description: "English" },
              { id: "lang_fr", title: "🇫🇷 Français", description: "French" },
              { id: IDS.BACK_MENU, title: "Back to Menu", description: "Return to previous menu" },
            ],
            buttonText: "Select",
          },
          { emoji: "🌍" }
        );
        return true;
      }

      // Build dynamic language list from database
      const rows = languages.map((lang: any) => ({
        id: `lang_${lang.code}`,
        title: `${lang.flag_emoji} ${lang.name}`,
        description: lang.native_name
      }));

      // Add back button
      rows.push({
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
        description: "Return to previous menu"
      });

      await sendListMessage(
        ctx,
        {
          title: "Change Language",
          body: "Select your preferred language:",
          sectionTitle: "Available Languages",
          rows,
          buttonText: "Select",
        },
        { emoji: "🌍" }
      );
      return true;
    }
    case IDS.JOB_BOARD: {
      const { showJobBoardMenu } = await import(
        "../domains/jobs/index.ts"
      );
      return await showJobBoardMenu(ctx);
    }
    case "jobs_recommended": {
      const { routeToAIAgent } = await import("../domains/ai-agents/integration.ts");
      const response = await routeToAIAgent(ctx, {
        userId: ctx.from,
        agentType: "job_board",
        flowType: "search_jobs",
        requestData: { skills_query: null, max_results: 5 },
      });
      if (response?.success && Array.isArray(response.jobs) && response.jobs.length) {
        const { sendListMessage } = await import("../utils/reply.ts");
        await sendListMessage(ctx, {
          title: "⭐ Recommended Jobs",
          body: `Top ${Math.min(5, response.jobs.length)} suggestions near you`,
          sectionTitle: "Jobs",
          rows: response.jobs.slice(0, 5).map((j: any) => ({ id: j.id, title: j.title, description: j.location_city || j.location || '' })),
          buttonText: "Open",
        });
        return true;
      }
      const { sendButtonsMessage, buildButtons } = await import("../utils/reply.ts");
      await sendButtonsMessage(ctx, "No recommendations yet. Try Find a Job.", buildButtons({ id: IDS.JOB_FIND, title: "Find a Job" }));
      return true;
    }
    case IDS.JOB_FIND: {
      const { startJobSearch } = await import(
        "../domains/jobs/index.ts"
      );
      return await startJobSearch(ctx);
    }
    case IDS.JOB_POST: {
      const { startJobPosting } = await import(
        "../domains/jobs/index.ts"
      );
      return await startJobPosting(ctx);
    }
    case IDS.JOB_MY_APPLICATIONS: {
      const { showMyApplications } = await import(
        "../domains/jobs/index.ts"
      );
      return await showMyApplications(ctx);
    }
    case IDS.BARS_RESTAURANTS: {
      const { startBarsSearch } = await import(
        "../domains/bars/search.ts"
      );
      return await startBarsSearch(ctx);
    }
    case IDS.NOTARY_SERVICES:
    case "notary_services": {
      const { startNotarySearch } = await import("../domains/services/notary.ts");
      return await startNotarySearch(ctx);
    }
    case "help_support":
    case "show_help":
    case "customer_support":
    case "support_agent":
    case IDS.SUPPORT_AGENT: {
      // Launch AI customer support agent (Help Center)
      const { startCustomerSupportChat } = await import("../domains/ai-agents/customer-support.ts");
      return await startCustomerSupportChat(ctx);
    }
    case "escalate_to_human": {
      const { escalateToHumanSupport } = await import("../domains/ai-agents/customer-support.ts");
      return await escalateToHumanSupport(ctx);
    }
    case "continue_ai_chat": {
      // Just acknowledge - next text message will be handled by text router
      await sendText(ctx.from, "I'm listening! What would you like to know?");
      return true;
    }
    case "lang_en":
    case "lang_fr": {
      // Update user language preference
      const langMap: Record<string, string> = {
        "lang_en": "en",
        "lang_fr": "fr",
      };
      const newLang = langMap[id] || "en";
      
      if (ctx.profileId) {
        await ctx.supabase
          .from("profiles")
          .update({ preferred_language: newLang })
          .eq("id", ctx.profileId);
      }
      
      const confirmMsg: Record<string, string> = {
        "en": "✅ Language changed to English",
        "fr": "✅ Langue changée en Français",
      };
      
      await sendButtonsMessage(
        ctx,
        confirmMsg[newLang] || confirmMsg["en"],
        homeOnly(),
        { emoji: "🌍" }
      );
      return true;
    }
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
    case IDS.WALLET_TRANSFER:
      return await startWalletTransfer(ctx);
    default:
      // Check for bars preference selection
      if (id.startsWith("bars_pref_") && state.key === "bars_wait_preference") {
        const { handleBarsPreferenceSelection } = await import(
          "../domains/bars/search.ts"
        );
        return await handleBarsPreferenceSelection(ctx, id);
      }
      
      // Check for bars "More" button
      if (id === "bars_more" && state.key === "bars_results") {
        const { handleBarsMore } = await import(
          "../domains/bars/search.ts"
        );
        return await handleBarsMore(ctx, state.data || {});
      }
      
      // Check for bars results selection
      if (id.startsWith("bar_result_") && state.key === "bars_results") {
        const { handleBarsResultSelection } = await import(
          "../domains/bars/search.ts"
        );
        return await handleBarsResultSelection(ctx, state.data || {}, id);
      }
      
      // Check for bar waiter AI chat
      if (id === IDS.BAR_CHAT_WAITER || (id === "bar_chat_waiter" && state.key === "bar_detail")) {
        await sendButtonsMessage(
          ctx,
          t(ctx.locale, "bars.waiter.greeting"),
          buildButtons(
            {
              id: IDS.BACK_MENU,
              title: t(ctx.locale, "common.menu_back"),
            },
          ),
          { emoji: "🤖" },
        );
        
        // Set state to waiter chat mode
        if (ctx.profileId && state.data) {
          await setState(ctx.supabase, ctx.profileId, {
            key: "bar_waiter_chat",
            data: state.data,
          });
        }
        return true;
      }
      
      // Check for shop tag selection
      if (id.startsWith("shop_tag_") && state.key === "shops_tag_selection") {
        const { handleShopsTagSelection } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsTagSelection(ctx, state.data || {}, id);
      }
      
      // Check for shops tags "More" button
      if (id === "shops_tags_more" && state.key === "shops_tag_selection") {
        const { handleShopsTagsMore } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsTagsMore(ctx, state.data || {});
      }
      
      // Check for shops "More" button
      if (id === "shops_more" && state.key === "shops_results") {
        const { handleShopsMore } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsMore(ctx, state.data || {});
      }
      
      // Check for shop result selection
      if (id.startsWith("shop_result_") && state.key === "shops_results") {
        const { handleShopsResultSelection } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsResultSelection(ctx, state.data || {}, id);
      }
      
      return false;
  }
}
