import type { RouterContext, WhatsAppTextMessage } from "../types.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { handleMomoText } from "../flows/momo/qr.ts";
import { handleWalletText } from "../domains/wallet/home.ts";
import { handleAdminCommand } from "../flows/admin/commands.ts";
import { applyReferralCodeFromMessage } from "../domains/wallet/referral.ts";
import { startInsurance } from "../domains/insurance/index.ts";
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
import { processPharmacyRequest } from "../domains/healthcare/pharmacies.ts";
import { processQuincaillerieRequest } from "../domains/healthcare/quincailleries.ts";
import { processNotaryRequest } from "../domains/services/notary.ts";
import { handleBarWaiterMessage } from "../domains/bars/waiter_ai.ts";

import {
  handleAddPropertyPrice,
  handleFindPropertyBudget,
} from "../domains/property/rentals.ts";
import { handleJobPostDetails } from "../domains/jobs/index.ts";
import { handleWalletTransferText } from "../domains/wallet/transfer.ts";

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
  
  // Check for active AI customer support chat
  if (state.key === "ai_customer_support_active") {
    const { handleCustomerSupportMessage } = await import("../domains/ai-agents/customer-support.ts");
    return await handleCustomerSupportMessage(
      ctx,
      body,
      state.data?.agent_config,
      state.data?.conversation_history || []
    );
  }
  
  if (state.key === "bar_waiter_chat") {
    return await handleBarWaiterMessage(ctx, body, state.data);
  }
  if (state.key === "wallet_transfer") {
    return await handleWalletTransferText(ctx, body, (state as any));
  }
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
  if (/^menu\s+[a-z0-9][a-z0-9_-]{1,}$/i.test(body)) {
    await sendDineInDisabledNotice(ctx);
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
      await processPharmacyRequest(ctx, stateData.location, body);
    }
    return true;
  }

  // Handle quincaillerie items input
  if (state.key === "quincaillerie_awaiting_items") {
    const stateData = state.data as { location?: { lat: number; lng: number } };
    if (stateData.location) {
      await processQuincaillerieRequest(ctx, stateData.location, body);
    }
    return true;
  }

  // Handle notary service input
  if (state.key === "notary_awaiting_service") {
    const stateData = state.data as { location?: { lat: number; lng: number } };
    if (stateData.location) {
      await processNotaryRequest(ctx, stateData.location, body);
    }
    return true;
  }
  
  // Handle business name search
  if (state.key === "business_claim") {
    const stateData = state.data as { stage?: string };
    if (stateData.stage === "awaiting_name") {
      const { handleBusinessNameSearch } = await import(
        "../domains/business/claim.ts"
      );
      return await handleBusinessNameSearch(ctx, body);
    }
  }
  
  // Handle add-new business text stages
  if (state.key === 'business_add_new') {
    const { handleAddNewBusinessText } = await import('../domains/business/add_new.ts');
    return await handleAddNewBusinessText(ctx, body, (state.data ?? {}) as any);
  }
  
  // Handle business WhatsApp number input
  if (state.key === "business_add_whatsapp") {
    const stateData = state.data as { businessId?: string; businessName?: string };
    if (stateData.businessId && stateData.businessName) {
      const { handleAddWhatsAppNumberText } = await import(
        "../domains/business/whatsapp_numbers.ts"
      );
      return await handleAddWhatsAppNumberText(
        ctx,
        body,
        stateData.businessId,
        stateData.businessName,
      );
    }
    return false;
  }
  
  // Handle property find duration input (for short-term)
  if (state.key === "property_find_duration") {
    const stateData = state.data as {
      rentalType: string;
      bedrooms: string;
    };
    const { handleFindPropertyDuration } = await import("../domains/property/rentals.ts");
    return await handleFindPropertyDuration(ctx, stateData, body);
  }
  

  // Handle property find budget input
  if (state.key === "property_find_budget") {
    const stateData = state.data as {
      rentalType: string;
      bedrooms: string;
      currency?: string;
      duration?: string;
    };
    return await handleFindPropertyBudget(ctx, stateData, body);
  }

  // Handle property add price input
  if (state.key === "property_add_price") {
    const stateData = state.data as {
      rentalType: string;
      bedrooms: string;
      currency?: string;
      priceUnit?: string;
    };
    return await handleAddPropertyPrice(ctx, stateData, body);
  }

  if (state.key === "job_post_details") {
    return await handleJobPostDetails(ctx, (state.data ?? {}) as any, body);
  }

  // Handle property AI chat - conversational mode
  if (state.key === "property_ai_chat") {
    const { handlePropertyAIChat } = await import("../domains/property/rentals.ts");
    return await handlePropertyAIChat(ctx, body);
  }

  // Handle job board AI conversations
  if (state.key === "job_conversation") {
    const { handleJobBoardText } = await import("../domains/jobs/index.ts");
    return await handleJobBoardText(ctx, body);
  }

  if (await handleMomoText(ctx, body, state)) {
    return true;
  }
  if (await handleWalletText(ctx, body, state)) {
    return true;
  }
  if (state.key?.startsWith("dine")) {
    await sendDineInDisabledNotice(ctx);
    return true;
  }
  // Marketplace flows removed
  if (
    (state.key === "ins_wait_doc" || state.key === "insurance_upload") &&
    /^(cancel|back)$/i.test(body)
  ) {
    await startInsurance(ctx, state);
    return true;
  }
  if (
    /^(menu|order|browse|start)$/i.test(body) || state.key?.startsWith("dine")
  ) {
    await sendDineInDisabledNotice(ctx);
    return true;
  }
  await sendHomeMenu(ctx);
  return true;
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendText(
    ctx.from,
    "Dine-in orders are handled separately. Please contact our team for assistance.",
  );
}
