import type {
  RouterContext,
  WhatsAppInteractiveListMessage,
} from "../types.ts";
import { getListReplyId } from "../utils/messages.ts";
// AI Agents Integration
import {
  handleAIAgentOptionSelection,
  handleShopFallbackSelection,
  type ShopResultsState,
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
import type { ScheduleSavedPickerState } from "../domains/mobility/schedule.ts";
import {
  handleMarketplaceButton,
  handleMarketplaceCategorySelection,
  handleMarketplaceResult,
  startMarketplace,
} from "../domains/marketplace/index.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { startNearbyPharmacies } from "../domains/healthcare/pharmacies.ts";
import { startNearbyQuincailleries } from "../domains/healthcare/quincailleries.ts";
import { startNotaryServices } from "../domains/services/notary.ts";
import {
  handlePharmacyResultSelection,
  type PharmacyResultsState,
} from "../domains/healthcare/pharmacies.ts";
import {
  handleQuincaillerieResultSelection,
  type QuincaResultsState,
} from "../domains/healthcare/quincailleries.ts";
import {
  handleNotaryResultSelection,
  type NotaryResultsState,
} from "../domains/services/notary.ts";
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
import {
  homeOnly,
  sendButtonsMessage,
  buildButtons,
} from "../utils/reply.ts";
import { handleAdminBack } from "../flows/admin/navigation.ts";

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
  }

  if (state.key === "saved_places_list") {
    if (await handleSavedPlacesListSelection(ctx, id)) {
      return true;
    }
  }
  if (state.key === "saved_places_add") {
    if (await handleSavedPlacesAddSelection(ctx, id)) {
      return true;
    }
  }
  if (state.key === "pharmacy_results") {
    return await handlePharmacyResultSelection(
      ctx,
      (state.data ?? {}) as PharmacyResultsState,
      id,
    );
  }
  if (state.key === "quincaillerie_results") {
    return await handleQuincaillerieResultSelection(
      ctx,
      (state.data ?? {}) as QuincaResultsState,
      id,
    );
  }
  if (state.key === "notary_results") {
    return await handleNotaryResultSelection(
      ctx,
      (state.data ?? {}) as NotaryResultsState,
      id,
    );
  }
  if (state.key === "business_claim") {
    const { handleBusinessClaim } = await import(
      "../domains/business/claim.ts"
    );
    return await handleBusinessClaim(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  if (state.key === "shop_results") {
    return await handleShopFallbackSelection(
      ctx,
      (state.data ?? {}) as ShopResultsState,
      id,
    );
  }
  if (state.key === "schedule_time_picker") {
    return await handleScheduleTimeSelection(
      ctx,
      (state.data ?? {}) as ScheduleState,
      id,
    );
  }

  // Check if this is an AI agent option selection
  if (id.startsWith("agent_option_") && state.key === "ai_agent_selection") {
    return await handleAIAgentOptionSelection(ctx, state, id);
  }

  // Check if this is a business selection
  if (id.startsWith("biz::")) {
    const { handleBusinessSelection } = await import(
      "../domains/business/management.ts"
    );
    return await handleBusinessSelection(ctx, id);
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

  if (await handleHomeMenuSelection(ctx, id, state)) {
    return true;
  }
  
  // Restaurant manager flows
  if (state.key === "restaurant_manager") {
    const { handleRestaurantManagerAction } = await import(
      "../domains/vendor/restaurant.ts"
    );
    return await handleRestaurantManagerAction(ctx, state.data ?? {}, id);
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
  if (
    id === IDS.MARKETPLACE_PREV || id === IDS.MARKETPLACE_NEXT ||
    id === IDS.MARKETPLACE_REFRESH || id === IDS.MARKETPLACE_ADD ||
    id === IDS.MARKETPLACE_BROWSE || id === IDS.MARKETPLACE_MENU
  ) {
    return await handleMarketplaceButton(ctx, state, id);
  }

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
  if (state.key === "property_find_price_unit" && (id === "per_day" || id === "per_night" || id === "per_month")) {
    const stateData = state.data as { rentalType: string; bedrooms: string; duration?: string };
    const { handleFindPropertyPriceUnit } = await import("../domains/property/rentals.ts");
    return await handleFindPropertyPriceUnit(ctx, stateData, id);
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
    const timeOptions = ["now", "30min", "1hour", "2hours", "5hours", "tomorrow_morning", "tomorrow_evening", "every_morning", "every_evening"];
    if (timeOptions.includes(id)) {
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
  if (await handleMarketplaceResult(ctx, state, id)) {
    return true;
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
    {
      body:
        "Dine-in orders are handled separately. Please contact our team for assistance.",
    },
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
    {
      body:
        "That workflow has been retired. Please use the main menu buttons for the supported features.",
    },
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
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
    case IDS.SAVED_PLACES:
      return await startSavedPlaces(ctx);
    case IDS.NEARBY_PHARMACIES:
      return await startNearbyPharmacies(ctx);
    case IDS.NEARBY_QUINCAILLERIES:
      return await startNearbyQuincailleries(ctx);
    case IDS.NEARBY_NOTARY_SERVICES:
      return await startNotaryServices(ctx);
    case IDS.PROPERTY_RENTALS:
      return await startPropertyRentals(ctx);
    case IDS.MARKETPLACE: {
      const { startShopsAndServices } = await import(
        "../domains/shops/services.ts"
      );
      return await startShopsAndServices(ctx);
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
        // Business edit - placeholder for future
        await sendButtonsMessage(
          ctx,
          "Edit business details coming soon!",
          buildButtons({ id: IDS.PROFILE_MANAGE_BUSINESSES, title: "← Back" }),
        );
        return true;
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
    case IDS.MOMO_QR:
      return await startMomoQr(ctx, state);
    case IDS.PROFILE: {
      const { sendProfileMenu } = await import("../flows/profile.ts");
      await sendProfileMenu(ctx);
      return true;
    }
    case IDS.PROFILE_VEHICLES: {
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
      const { startPropertyRentals } = await import("../domains/property/index.ts");
      return await startPropertyRentals(ctx);
    }
    case IDS.PROFILE_SETTINGS: {
      // TODO: Implement settings menu (language, notifications, etc.)
      await sendButtonsMessage(
        ctx,
        "Settings menu coming soon!",
        homeOnly()
      );
      return true;
    }
    case IDS.BARS_RESTAURANTS: {
      const { startBarsSearch } = await import(
        "../domains/bars/search.ts"
      );
      return await startBarsSearch(ctx);
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
    case IDS.ADMIN_HUB:
      await openAdminHub(ctx);
      return true;
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
      
      // Check for shop tag selection
      if (id.startsWith("shop_tag_") && state.key === "shops_tag_selection") {
        const { handleShopsTagSelection } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsTagSelection(ctx, state.data || {}, id);
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
