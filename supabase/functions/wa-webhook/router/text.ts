import type { RouterContext, WhatsAppTextMessage } from "../types.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { handleMarketplaceText } from "../domains/marketplace/index.ts";
import { handleMomoText } from "../flows/momo/qr.ts";
import { handleWalletText } from "../domains/wallet/home.ts";
import { handleStaffVerification } from "../flows/staff.ts";
import { handleAdminCommand } from "../flows/admin/commands.ts";
import { applyReferralCodeFromMessage } from "../domains/wallet/referral.ts";
import {
  handleBarRow as dineHandleBarRow,
  openBarBySlug,
  openManagerPortal,
  startDineIn,
} from "../domains/dinein/browse.ts";
import { openMenu } from "../domains/dinein/menu.ts";
import { handleItemRow as dineHandleItemRow } from "../domains/dinein/item.ts";
import { handleOrderMore, handlePayOrder } from "../domains/dinein/order.ts";
import {
  DINE_IDS,
  makeBarRowId,
  makeItemRowId,
} from "../domains/dinein/ids.ts";
import { DINE_STATE } from "../domains/dinein/state.ts";
import { startInsurance } from "../domains/insurance/index.ts";
import {
  handleAddWhatsappText,
  handleNumbersAddText,
  handleNumbersRemoveText,
  handleOnboardContactsText,
  handleOnboardIdentityText,
  handleOnboardLocationText,
  handleOnboardPaymentText,
  handleReviewEditText,
} from "../domains/dinein/manager.ts";
import { handleDineBack } from "../domains/dinein/navigation.ts";
import {
  handleVehiclePlateInput,
  normalizePlate,
  parsePlateState,
  vehiclePlateStateKey,
} from "../domains/mobility/vehicle_plate.ts";
import { handleScheduleRole } from "../domains/mobility/schedule.ts";
import { handleSeePassengers } from "../domains/mobility/nearby.ts";
import { sendText } from "../wa/client.ts";
import { t } from "../i18n/translator.ts";
import { maybeHandleDriverText } from "../observe/driver_parser.ts";
import { recordInbound } from "../observe/conv_audit.ts";
import { getTextBody } from "../utils/messages.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";

// AI Agents Integration
import {
  handleAINearbyDrivers,
  handleAINearbyPharmacies,
  handleAINearbyQuincailleries,
  handleAINearbyShops,
  handleAIPropertyRental,
  handleAIScheduleTrip,
} from "../domains/ai-agents/index.ts";
import {
  handleFindPropertyBudget,
  handleAddPropertyPrice,
} from "../domains/property/rentals.ts";

export async function handleText(
  ctx: RouterContext,
  msg: WhatsAppTextMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const body = getTextBody(msg);
  if (!body) return false;
  // Record inbound for correlation (best-effort)
  try {
    await recordInbound(ctx, msg);
  } catch (_) { /* noop */ }
  // Best-effort driver offer parsing (non-blocking)
  try {
    await maybeHandleDriverText(ctx, msg);
  } catch (_) { /* noop */ }
  if (state.key === vehiclePlateStateKey) {
    const resume = parsePlateState(state.data);
    if (!resume) {
      await sendHomeMenu(ctx);
      return true;
    }
    const error = await handleVehiclePlateInput(ctx, resume, body);
    if (error) {
      await sendText(
        ctx.from,
        `${error} ${t(ctx.locale, "vehicle.plate.reply_with_plate")}`,
      );
      return true;
    }
    const saved = normalizePlate(body) ?? body.trim();
    await sendText(
      ctx.from,
      t(ctx.locale, "vehicle.plate.saved", { plate: saved }),
    );
    if (resume.type === "schedule_role") {
      await handleScheduleRole(ctx, resume.roleId);
    } else if (resume.type === "nearby_passengers") {
      await handleSeePassengers(ctx);
    }
    return true;
  }
  const referralMatch = body.match(/^ref[:：]\s*([a-z0-9]{4,32})$/i);
  if (referralMatch) {
    const code = referralMatch[1];
    if (await applyReferralCodeFromMessage(ctx, code)) {
      return true;
    }
  }
  const menuSlugMatch = body.match(/^menu\s+([a-z0-9][a-z0-9_-]{1,})$/i);
  if (menuSlugMatch) {
    if (await openBarBySlug(ctx, menuSlugMatch[1].toLowerCase())) {
      return true;
    }
  }
  const momoStates = new Set([
    "momo_qr_menu",
    "momo_qr_number",
    "momo_qr_code",
    "momo_qr_amount",
  ]);
  const dineOnboardingStates = new Set<string>([
    DINE_STATE.ONBOARD_IDENTITY,
    DINE_STATE.ONBOARD_LOCATION,
    DINE_STATE.ONBOARD_PAYMENT,
    DINE_STATE.ONBOARD_CONTACTS,
    DINE_STATE.ONBOARD_UPLOAD,
  ]);
  if (
    !momoStates.has(state.key) &&
    !dineOnboardingStates.has(state.key) &&
    await handleStaffVerification(ctx, body)
  ) {
    return true;
  }
  if (body.startsWith("/")) {
    return await handleAdminCommand(ctx, body);
  }
  if (
    state.key === "mobility_nearby_select" ||
    state.key === "mobility_nearby_location"
  ) {
    return false; // expect list or location
  }
  
  // Handle pharmacy medicine input
  if (state.key === "pharmacy_awaiting_medicine") {
    const stateData = state.data as { location?: { lat: number; lng: number } };
    if (stateData.location) {
      const medications = body.toLowerCase() === "search" ? undefined : [body];
      if (isFeatureEnabled("agent.pharmacy")) {
        return await handleAINearbyPharmacies(
          ctx,
          stateData.location,
          medications,
        );
      }
    }
    return true;
  }
  
  // Handle quincaillerie items input
  if (state.key === "quincaillerie_awaiting_items") {
    const stateData = state.data as { location?: { lat: number; lng: number } };
    if (stateData.location) {
      const items = body.toLowerCase() === "search" ? undefined : [body];
      if (isFeatureEnabled("agent.quincaillerie")) {
        return await handleAINearbyQuincailleries(
          ctx,
          stateData.location,
          items,
        );
      }
    }
    return true;
  }
  
  // Handle property find budget input
  if (state.key === "property_find_budget") {
    const stateData = state.data as { rentalType: string; bedrooms: string };
    return await handleFindPropertyBudget(ctx, stateData, body);
  }
  
  // Handle property add price input
  if (state.key === "property_add_price") {
    const stateData = state.data as { rentalType: string; bedrooms: string };
    return await handleAddPropertyPrice(ctx, stateData, body);
  }
  
  if (await handleMomoText(ctx, body, state)) {
    return true;
  }
  if (await handleWalletText(ctx, body, state)) {
    return true;
  }
  if (await handleOnboardIdentityText(ctx, state, body)) {
    return true;
  }
  if (await handleOnboardLocationText(ctx, state, body)) {
    return true;
  }
  if (await handleOnboardPaymentText(ctx, state, body)) {
    return true;
  }
  if (await handleOnboardContactsText(ctx, state, body)) {
    return true;
  }
  if (await handleReviewEditText(ctx, state, body)) {
    return true;
  }
  if (await handleNumbersAddText(ctx, state, body)) {
    return true;
  }
  if (await handleNumbersRemoveText(ctx, state, body)) {
    return true;
  }
  if (await handleAddWhatsappText(ctx, state, body)) {
    return true;
  }
  if (await handleMarketplaceText(ctx, body, state)) {
    return true;
  }
  if (
    (state.key === "ins_wait_doc" || state.key === "insurance_upload") &&
    /^(cancel|back)$/i.test(body)
  ) {
    await startInsurance(ctx, state);
    return true;
  }
  if (/^(menu|order|browse|start)$/i.test(body)) {
    await startDineIn(ctx, state);
    return true;
  }
  if (/^(back|←\s*back)$/i.test(body) && state.key?.startsWith("dine")) {
    if (await handleDineBack(ctx, state)) {
      return true;
    }
  }
  if (/^[0-9]+$/.test(body)) {
    if (await handleDineNumeric(ctx, body, state)) return true;
  }
  await sendHomeMenu(ctx);
  return true;
}

async function handleDineNumeric(
  ctx: RouterContext,
  body: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const choice = Number(body);
  if (!Number.isFinite(choice)) return false;

  const goMainMenu = async () => {
    await startDineIn(ctx, { key: "dine_home", data: {} }, {
      skipResume: true,
    });
    return true;
  };

  if (state.key === "dine_bars") {
    const ids = Array.isArray(state.data?.bar_ids)
      ? state.data?.bar_ids as string[]
      : [];
    const index = choice - 1;
    if (index >= 0 && index < ids.length) {
      return await dineHandleBarRow(ctx, makeBarRowId(ids[index]));
    }
    if (choice === 0) return await goMainMenu();
    const offset = Number(state.data?.offset ?? 0);
    await startDineIn(ctx, state, { skipResume: true, offset });
    return true;
  }

  if (state.key === "dine_bar") {
    const canManage = Boolean(state.data?.can_manage);
    if (choice === 1) return await openMenu(ctx, state);
    if (canManage && choice === 2) return await openManagerPortal(ctx, state);
    if (choice === 0) return await goMainMenu();
    await openMenu(ctx, state);
    return true;
  }

  if (state.key === "dine_items") {
    const ids = Array.isArray(state.data?.item_ids)
      ? state.data?.item_ids as string[]
      : [];
    const index = choice - 1;
    if (index >= 0 && index < ids.length) {
      return await dineHandleItemRow(ctx, makeItemRowId(ids[index]), state);
    }
    const nextOffset = typeof state.data?.next_offset === "number"
      ? Number(state.data?.next_offset)
      : null;
    const prevOffset = typeof state.data?.prev_offset === "number"
      ? Number(state.data?.prev_offset)
      : null;
    if (nextOffset !== null && choice === ids.length + 1) {
      return await openMenu(ctx, state, { offset: nextOffset });
    }
    if (prevOffset !== null && choice === ids.length + 2) {
      return await openMenu(ctx, state, { offset: prevOffset });
    }
    if (choice === 0) return await goMainMenu();
    await openMenu(ctx, state);
    return true;
  }

  if (state.key === "dine_order") {
    if (choice === 1) return await handlePayOrder(ctx, state);
    if (choice === 2) return await handleOrderMore(ctx, state);
    if (choice === 0) return await goMainMenu();
    await handlePayOrder(ctx, state);
    return true;
  }

  return false;
}
