import type {
  RouterContext,
  WhatsAppInteractiveButtonMessage,
} from "../types.ts";
import { getButtonReplyId } from "../utils/messages.ts";
import { t } from "../i18n/translator.ts";
import { IDS } from "../wa/ids.ts";
import {
  handleChangeVehicleRequest,
  handleSeeDrivers,
  handleSeePassengers,
  startNearbySavedLocationPicker,
} from "../domains/mobility/nearby.ts";
import {
  handleScheduleChangeVehicle,
  handleScheduleRecurrenceSelection,
  handleScheduleRefresh,
  handleScheduleRole,
  handleScheduleSkipDropoff,
  requestScheduleDropoff,
  startScheduleSavedLocationPicker,
  startScheduleTrip,
} from "../domains/mobility/schedule.ts";
import {
  handleMarketplaceButton,
  startMarketplace,
} from "../domains/marketplace/index.ts";
import { startInsurance } from "../domains/insurance/index.ts";
import {
  replayBarsResults,
  startBarsSearch,
  startBarMenuOrder,
} from "../domains/bars/search.ts";
import { startBarWaiterChat } from "../domains/bars/waiter_ai.ts";
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
import { buildButtons, sendButtonsMessage, homeOnly } from "../utils/reply.ts";
import {
  handleQuickSaveLocation,
  LOCATION_KIND_BY_ID,
} from "../domains/locations/save.ts";
import {
  startSavedPlaces,
  startSavedPlaceCreation,
  SAVED_PLACES_ADD_ID,
  SAVED_PLACES_SKIP_ID,
} from "../domains/locations/manage.ts";
import { startPropertySavedLocationPicker } from "../domains/property/rentals.ts";
import {
  MENU_ORDER_ACTIONS_STATE,
  handleMenuOrderAction,
  type MenuOrderSession,
} from "../domains/orders/menu_order.ts";
import { setState } from "../state/store.ts";
import {
  replayJobCandidates,
  replayJobResults,
  showJobCandidates,
  startJobPosting,
  startJobSavedLocationPicker,
  startJobSearch,
  type JobCandidatesState,
  type JobFindLocationState,
  type JobFindResultsState,
  type JobPostState,
} from "../domains/jobs/index.ts";

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
  if (id.startsWith("lang_")) {
    const langCode = id.slice(5).toLowerCase();
    const { data: languageRow } = await ctx.supabase
      .from("supported_languages")
      .select("code, name")
      .eq("code", langCode)
      .maybeSingle();

    const resolvedCode = languageRow?.code ?? "en";

    if (ctx.profileId) {
      await ctx.supabase
        .from("profiles")
        .update({ preferred_language: resolvedCode })
        .eq("id", ctx.profileId);
    }

    const displayName = languageRow?.name ?? resolvedCode.toUpperCase();
    await sendButtonsMessage(
      ctx,
      `✅ Language changed to ${displayName}`,
      homeOnly(),
      { emoji: "🌍" },
    );
    return true;
  }
  switch (id) {
    case IDS.SEE_DRIVERS:
      return await handleSeeDrivers(ctx);
    case IDS.SEE_PASSENGERS:
      return await handleSeePassengers(ctx);
    case IDS.SCHEDULE_TRIP:
      return await startScheduleTrip(ctx, state);
    case IDS.JOB_FIND:
    case IDS.JOB_FIND_AGAIN:
      return await startJobSearch(ctx);
    case IDS.JOB_POST:
      return await startJobPosting(ctx);
    case IDS.JOB_RESULTS_BACK:
      if (state.key === "job_find_results") {
        return await replayJobResults(
          ctx,
          (state.data ?? {}) as JobFindResultsState,
        );
      }
      return false;
    case IDS.JOB_CANDIDATES_BACK:
      if (state.key === "job_candidates_results") {
        return await replayJobCandidates(
          ctx,
          (state.data ?? {}) as JobCandidatesState,
        );
      }
      return false;
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
    case IDS.BAR_VIEW_MENU: {
      if (state.key === "bar_detail") {
        return await startBarMenuOrder(ctx, state.data || {});
      }
      return false;
    }
    case "bars_search_now": {
      if (state.key === "bar_detail" && state.data?.barsResults) {
        const replayed = await replayBarsResults(
          ctx,
          state.data.barsResults as any,
        );
        if (replayed) return true;
      }
      return await startBarsSearch(ctx);
    }
    case IDS.BAR_CHAT_WAITER:
    case "bar_chat_waiter": {
      if (state.key === "bar_detail") {
        return await startBarWaiterChat(ctx, state.data || {});
      }
      return false;
    }
    case IDS.MENU_ORDER_ADD:
    case IDS.MENU_ORDER_VIEW:
    case IDS.MENU_ORDER_FINISH:
      if (state.key === MENU_ORDER_ACTIONS_STATE) {
        return await handleMenuOrderAction(
          ctx,
          (state.data ?? {}) as MenuOrderSession,
          id,
        );
      }
      return false;
    case IDS.ROLE_DRIVER:
    case IDS.ROLE_PASSENGER:
      return await handleScheduleRole(ctx, id);
    case IDS.SCHEDULE_ADD_DROPOFF:
      return await requestScheduleDropoff(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_SKIP_DROPOFF:
      return await handleScheduleSkipDropoff(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_REFRESH_RESULTS:
      return await handleScheduleRefresh(ctx, (state.data ?? {}) as any);
    case IDS.SCHEDULE_RECUR_NONE:
    case IDS.SCHEDULE_RECUR_WEEKDAYS:
    case IDS.SCHEDULE_RECUR_DAILY:
      if (state.key === "schedule_recur") {
        return await handleScheduleRecurrenceSelection(
          ctx,
          (state.data ?? {}) as any,
          id,
        );
      }
      return false;
    case IDS.LOCATION_SAVED_LIST:
      if (state.key === "mobility_nearby_location") {
        return await startNearbySavedLocationPicker(
          ctx,
          (state.data ?? {}) as any,
        );
      }
      if (state.key === "schedule_location") {
        return await startScheduleSavedLocationPicker(
          ctx,
          (state.data ?? {}) as any,
          "pickup",
        );
      }
      if (state.key === "schedule_dropoff") {
        return await startScheduleSavedLocationPicker(
          ctx,
          (state.data ?? {}) as any,
          "dropoff",
        );
      }
      if (state.key === "property_find_location") {
        return await startPropertySavedLocationPicker(
          ctx,
          "find",
          (state.data ?? {}) as any,
        );
      }
      if (state.key === "property_add_location") {
        return await startPropertySavedLocationPicker(
          ctx,
          "add",
          (state.data ?? {}) as any,
        );
      }
      if (state.key === "job_find_location") {
        return await startJobSavedLocationPicker(
          ctx,
          "find",
          (state.data ?? {}) as JobFindLocationState,
        );
      }
      if (state.key === "job_post_location") {
        return await startJobSavedLocationPicker(
          ctx,
          "post",
          (state.data ?? {}) as JobPostState,
        );
      }
      return false;
    case IDS.SAVED_PLACES:
      return await startSavedPlaces(ctx);
    case SAVED_PLACES_ADD_ID:
      return await startSavedPlaceCreation(ctx);
    case SAVED_PLACES_SKIP_ID: {
      if (await handleSavedPlacesSkip(ctx, state)) {
        return true;
      }
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "location.saved.skip_message", {
          instructions: t(ctx.locale, "location.share.instructions"),
        }),
        homeOnly(),
      );
      return true;
    }
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
    case IDS.BUSINESS_DELETE_CONFIRM: {
      if (
        state.key === "business_delete_confirm" &&
        state.data?.businessId &&
        state.data?.businessName
      ) {
        const { confirmBusinessDelete } = await import(
          "../domains/business/management.ts"
        );
        return await confirmBusinessDelete(
          ctx,
          state.data.businessId as string,
          state.data.businessName as string,
        );
      }
      return false;
    }
    case IDS.BACK_HOME: {
      const { sendHomeMenu } = await import("../flows/home.ts");
      await sendHomeMenu(ctx);
      return true;
    }

    default:
      if (LOCATION_KIND_BY_ID[id]) {
        return await handleQuickSaveLocation(ctx, LOCATION_KIND_BY_ID[id]);
      }
      if (await handleMarketplaceButton(ctx, state, id)) return true;
      
      // Removed: bars_search_now button (now goes direct to location)
      // Removed: pharmacy_search_now button (now goes direct to results)
      // Removed: quincaillerie_search_now button (now goes direct to results)
      
      // Check for shops browse button
      if (id === "shops_browse_tags") {
        const { handleShopsBrowseButton } = await import(
          "../domains/shops/services.ts"
        );
        return await handleShopsBrowseButton(ctx);
      }
      if (id.startsWith("job_candidates::")) {
        const jobId = id.substring("job_candidates::".length);
        if (jobId) {
          return await showJobCandidates(ctx, jobId);
        }
        return false;
      }
      
      // Removed: pharmacy_search_now and quincaillerie_search_now buttons
      // These flows now go directly to showing results after location
      
      return false;
  }
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendButtonsMessage(
    ctx,
    "Dine-in orders are handled separately. Please contact our team for assistance.",
    buildButtons({ id: IDS.BACK_HOME, title: "🏠 Back" }),
    { emoji: "ℹ️" },
  );
}

async function handleSavedPlacesSkip(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "location_saved_picker" || !state.data) {
    return false;
  }
  const source = state.data.source as string | undefined;
  const instructions = t(ctx.locale, "location.share.instructions");

  switch (source) {
    case "nearby": {
      const snapshot = state.data.snapshot as
        | { mode?: string; vehicle?: string; pickup?: { lat: number; lng: number } | null }
        | undefined;
      if (!snapshot?.mode || !snapshot?.vehicle) break;
      await setState(ctx.supabase, ctx.profileId, {
        key: "mobility_nearby_location",
        data: {
          mode: snapshot.mode,
          vehicle: snapshot.vehicle,
          pickup: snapshot.pickup ?? undefined,
        },
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "mobility.nearby.share_location", { instructions }),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    case "schedule": {
      const stage = state.data.stage === "dropoff" ? "dropoff" : "pickup";
      const scheduleState = state.data.state as Record<string, unknown>;
      const key = stage === "dropoff" ? "schedule_dropoff" : "schedule_location";
      await setState(ctx.supabase, ctx.profileId, { key, data: scheduleState });
      await sendButtonsMessage(
        ctx,
        t(
          ctx.locale,
          stage === "dropoff" ? "schedule.dropoff.prompt" : "schedule.pickup.prompt",
          { instructions },
        ),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    case "property_find": {
      const findState = state.data.state as Record<string, unknown>;
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_find_location",
        data: findState,
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "property.find.prompt.location", { instructions }),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    case "property_add": {
      const addState = state.data.state as Record<string, unknown>;
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_add_location",
        data: addState,
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "property.add.prompt.location", { instructions }),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    case "job_find": {
      const jobState = state.data.state as JobFindLocationState;
      await setState(ctx.supabase, ctx.profileId, {
        key: "job_find_location",
        data: jobState,
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "jobs.find.prompt.location", { instructions }),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    case "job_post": {
      const jobState = state.data.state as JobPostState;
      await setState(ctx.supabase, ctx.profileId, {
        key: "job_post_location",
        data: jobState,
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "jobs.post.prompt.location", { instructions }),
        buildButtons(
          { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    default:
      break;
  }
  return false;
}
