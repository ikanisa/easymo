/**
 * Concierge Flow Handler
 *
 * Handles the vendor outreach concierge flow:
 * 1. User requests product/service
 * 2. Agent finds nearby businesses
 * 3. Agent asks for permission to contact vendors
 * 4. Agent messages vendors and collects replies
 * 5. Agent returns shortlist of confirmed vendors
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import { sendText, sendButtons } from "../../_shared/wa-webhook-shared/wa/client.ts";
import {
  searchBusinesses,
  createVendorInquiriesAndMessageVendors,
  getVendorInquiryUpdates,
  formatVendorShortlist,
  type BusinessSearchResult,
  type VendorInquiryCreateParams,
} from "./vendor_inquiry_tools.ts";

// =====================================================
// TYPES
// =====================================================

export interface ConciergeState {
  step: "idle" | "searching" | "awaiting_consent" | "contacting_vendors" | "awaiting_replies" | "showing_results";
  requestSummary?: string;
  requestType?: "product" | "service" | "medicine";
  structuredPayload?: VendorInquiryCreateParams["structuredPayload"];
  searchResults?: BusinessSearchResult[];
  selectedBusinessIds?: string[];
  inquiryId?: string;
  expiresAt?: string;
}

export interface ConciergeContext {
  userPhone: string;
  userId?: string;
  userLat?: number;
  userLng?: number;
  state: ConciergeState;
  supabase: SupabaseClient;
  correlationId?: string;
}

// =====================================================
// STATE MANAGEMENT
// =====================================================

const conciergeStates = new Map<string, ConciergeState>();

/**
 * Get or initialize concierge state for a user
 */
export function getConciergeState(userPhone: string): ConciergeState {
  return conciergeStates.get(userPhone) || { step: "idle" };
}

/**
 * Update concierge state for a user
 */
export function setConciergeState(userPhone: string, state: Partial<ConciergeState>): void {
  const current = getConciergeState(userPhone);
  conciergeStates.set(userPhone, { ...current, ...state });
}

/**
 * Clear concierge state for a user
 */
export function clearConciergeState(userPhone: string): void {
  conciergeStates.delete(userPhone);
}

// =====================================================
// CONCIERGE FLOW HANDLERS
// =====================================================

/**
 * Start concierge flow by searching for nearby businesses
 */
export async function startConciergeSearch(
  ctx: ConciergeContext,
  requestSummary: string,
  requestType: "product" | "service" | "medicine",
  structuredPayload: VendorInquiryCreateParams["structuredPayload"],
  searchParams: {
    categories?: string[];
    tags?: string[];
    limit?: number;
  },
): Promise<{ success: boolean; businesses: BusinessSearchResult[] }> {
  const startTime = Date.now();

  try {
    logStructuredEvent("CONCIERGE_SEARCH_START", {
      userPhone: ctx.userPhone.slice(-4),
      requestType,
      hasLocation: !!(ctx.userLat && ctx.userLng),
      correlationId: ctx.correlationId,
    });

    // Update state
    setConciergeState(ctx.userPhone, {
      step: "searching",
      requestSummary,
      requestType,
      structuredPayload,
    });

    // Search for businesses
    const searchResult = await searchBusinesses(
      ctx.supabase,
      {
        queryText: requestSummary,
        categories: searchParams.categories,
        tags: searchParams.tags,
        userLat: ctx.userLat,
        userLng: ctx.userLng,
        radiusKm: 10,
        limit: searchParams.limit || 10,
      },
      ctx.correlationId,
    );

    if (!searchResult.ok || !searchResult.data) {
      logStructuredEvent("CONCIERGE_SEARCH_FAILED", {
        error: searchResult.error?.msg,
        correlationId: ctx.correlationId,
      }, "warn");

      clearConciergeState(ctx.userPhone);
      return { success: false, businesses: [] };
    }

    const businesses = searchResult.data;

    // Update state with results
    setConciergeState(ctx.userPhone, {
      step: "awaiting_consent",
      searchResults: businesses,
      selectedBusinessIds: businesses.slice(0, 4).map((b) => b.id), // Select top 4 by default
    });

    const duration = Date.now() - startTime;
    logStructuredEvent("CONCIERGE_SEARCH_COMPLETE", {
      userPhone: ctx.userPhone.slice(-4),
      resultCount: businesses.length,
      durationMs: duration,
      correlationId: ctx.correlationId,
    });

    recordMetric("buy_sell.concierge.search", 1, {
      result_count: businesses.length,
    });

    return { success: true, businesses };

  } catch (error) {
    const duration = Date.now() - startTime;
    logStructuredEvent("CONCIERGE_SEARCH_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
      correlationId: ctx.correlationId,
    }, "error");

    clearConciergeState(ctx.userPhone);
    return { success: false, businesses: [] };
  }
}

/**
 * Generate consent request message with buttons
 */
export function generateConsentMessage(
  businesses: BusinessSearchResult[],
  requestSummary: string,
  maxToContact: number = 4,
): { text: string; buttons: Array<{ id: string; title: string }> } {
  const count = Math.min(businesses.length, maxToContact);

  let text = `🔍 *Found ${businesses.length} matching businesses!*\n\n`;
  text += `Looking for: "${requestSummary}"\n\n`;

  if (businesses.length <= 3) {
    // Show all if few results
    businesses.forEach((biz, i) => {
      const distance = biz.distanceKm ? ` (${biz.distanceKm.toFixed(1)}km)` : "";
      text += `${i + 1}. ${biz.name}${distance}\n`;
    });
    text += "\n";
  } else {
    // Show summary
    const nearest = businesses[0];
    const furthest = businesses[businesses.length - 1];
    text += `📍 Nearest: ${nearest.name}`;
    if (nearest.distanceKm) text += ` (${nearest.distanceKm.toFixed(1)}km)`;
    text += `\n📍 Furthest: ${furthest.name}`;
    if (furthest.distanceKm) text += ` (${furthest.distanceKm.toFixed(1)}km)`;
    text += "\n\n";
  }

  text += `I can message up to ${count} of them on your behalf to check if they have what you need.\n\n`;
  text += `_Do you want me to contact them for you?_`;

  return {
    text,
    buttons: [
      { id: "concierge_contact_yes", title: "✅ Yes, contact them" },
      { id: "concierge_change_request", title: "✏️ Change request" },
      { id: "concierge_show_list", title: "📋 Just show list" },
    ],
  };
}

/**
 * Handle user consent to contact vendors
 */
export async function handleVendorOutreachConsent(
  ctx: ConciergeContext,
  consent: "yes" | "no" | "show_list",
  sendWhatsAppMessage: (phone: string, message: string) => Promise<{ messageId?: string; error?: string }>,
): Promise<{ success: boolean; inquiryId?: string; error?: string }> {
  const state = getConciergeState(ctx.userPhone);

  if (state.step !== "awaiting_consent" || !state.selectedBusinessIds || !state.requestSummary) {
    return { success: false, error: "No pending consent request" };
  }

  if (consent === "no") {
    clearConciergeState(ctx.userPhone);
    return { success: true };
  }

  if (consent === "show_list") {
    // Just show the business list without contacting
    setConciergeState(ctx.userPhone, { step: "showing_results" });
    return { success: true };
  }

  // User said yes - proceed with vendor outreach
  try {
    logStructuredEvent("CONCIERGE_OUTREACH_START", {
      userPhone: ctx.userPhone.slice(-4),
      vendorCount: state.selectedBusinessIds.length,
      correlationId: ctx.correlationId,
    });

    setConciergeState(ctx.userPhone, { step: "contacting_vendors" });

    const result = await createVendorInquiriesAndMessageVendors(
      ctx.supabase,
      {
        userId: ctx.userId,
        userPhone: ctx.userPhone,
        businessIds: state.selectedBusinessIds,
        requestType: state.requestType || "product",
        requestSummary: state.requestSummary,
        structuredPayload: state.structuredPayload || {},
        userLat: ctx.userLat,
        userLng: ctx.userLng,
      },
      sendWhatsAppMessage,
      ctx.correlationId,
    );

    if (!result.ok || !result.data) {
      logStructuredEvent("CONCIERGE_OUTREACH_FAILED", {
        error: result.error?.msg,
        correlationId: ctx.correlationId,
      }, "error");

      clearConciergeState(ctx.userPhone);
      return { success: false, error: result.error?.msg || "Failed to contact vendors" };
    }

    // Update state with inquiry ID
    setConciergeState(ctx.userPhone, {
      step: "awaiting_replies",
      inquiryId: result.data.inquiryId,
      expiresAt: result.data.expiresAt,
    });

    logStructuredEvent("CONCIERGE_OUTREACH_COMPLETE", {
      inquiryId: result.data.inquiryId,
      vendorCount: result.data.vendorIds.length,
      messagesSent: result.data.messagesSent,
      correlationId: ctx.correlationId,
    });

    recordMetric("buy_sell.concierge.outreach", 1, {
      vendors_contacted: result.data.messagesSent,
    });

    return { success: true, inquiryId: result.data.inquiryId };

  } catch (error) {
    logStructuredEvent("CONCIERGE_OUTREACH_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: ctx.correlationId,
    }, "error");

    clearConciergeState(ctx.userPhone);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Check for vendor replies and format shortlist
 */
export async function checkVendorRepliesAndFormat(
  ctx: ConciergeContext,
): Promise<{ success: boolean; message: string; hasConfirmed: boolean }> {
  const state = getConciergeState(ctx.userPhone);

  if (!state.inquiryId) {
    return { success: false, message: "No active inquiry", hasConfirmed: false };
  }

  try {
    const result = await getVendorInquiryUpdates(
      ctx.supabase,
      state.inquiryId,
      ctx.correlationId,
    );

    if (!result.ok || !result.data) {
      return { success: false, message: result.error?.msg || "Failed to check replies", hasConfirmed: false };
    }

    const { replies, status, confirmedCount } = result.data;

    // Format the shortlist message
    const message = formatVendorShortlist(replies, state.requestSummary || "your request");

    // Update state if complete or expired
    if (status === "complete" || status === "expired") {
      setConciergeState(ctx.userPhone, { step: "showing_results" });
    }

    logStructuredEvent("CONCIERGE_REPLIES_CHECKED", {
      inquiryId: state.inquiryId,
      status,
      repliedCount: result.data.repliedCount,
      confirmedCount,
      correlationId: ctx.correlationId,
    });

    return { success: true, message, hasConfirmed: confirmedCount > 0 };

  } catch (error) {
    logStructuredEvent("CONCIERGE_REPLIES_CHECK_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: ctx.correlationId,
    }, "error");

    return { success: false, message: "Error checking replies", hasConfirmed: false };
  }
}

/**
 * Generate waiting message while collecting vendor replies
 */
export function generateWaitingMessage(vendorCount: number, requestSummary: string): string {
  return (
    `📤 *Contacting ${vendorCount} businesses...*\n\n` +
    `I'm asking about: "${requestSummary}"\n\n` +
    `⏳ Please wait 1-2 minutes while I collect their replies.\n\n` +
    `I'll send you a shortlist of businesses that confirm they can help!`
  );
}

/**
 * Generate message when no vendors responded or confirmed
 */
export function generateNoMatchesMessage(state: ConciergeState): string {
  return (
    `😔 *No Confirmations Yet*\n\n` +
    `None of the businesses I contacted confirmed they have "${state.requestSummary}".\n\n` +
    `You can:\n` +
    `• Wait a bit longer (some might still reply)\n` +
    `• Try a different request\n` +
    `• Browse the business directory directly`
  );
}
