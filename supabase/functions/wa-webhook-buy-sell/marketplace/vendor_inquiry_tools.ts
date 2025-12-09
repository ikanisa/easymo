/**
 * Vendor Inquiry Tools for Buy & Sell Concierge
 *
 * These tools enable the Buy & Sell AI agent to:
 * 1. Search businesses with tags and metadata
 * 2. Create vendor inquiries and message vendors on behalf of users
 * 3. Collect and interpret vendor replies
 * 4. Log user feedback on vendor accuracy
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";

// =====================================================
// TYPES
// =====================================================

export interface BusinessSearchParams {
  queryText?: string;
  categories?: string[];
  tags?: string[];
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
  limit?: number;
}

export interface BusinessSearchResult {
  id: string;
  name: string;
  category: string;
  address?: string;
  phone?: string;
  ownerWhatsapp?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  distanceKm?: number;
  relevanceScore?: number;
  responseRate?: number;
  responseTimeAvgSec?: number;
}

export interface VendorInquiryCreateParams {
  userId?: string;
  userPhone: string;
  businessIds: string[];
  requestType: "product" | "service" | "medicine";
  requestSummary: string;
  structuredPayload: {
    item?: string;
    quantity?: number;
    budget?: number;
    timeframe?: string;
    pickupArea?: string;
    brand?: string;
    constraints?: string[];
  };
  userLat?: number;
  userLng?: number;
  language?: string;
}

export interface VendorInquiryResult {
  inquiryId: string;
  vendorIds: string[];
  messagesSent: number;
  expiresAt: string;
}

export interface VendorReply {
  businessId: string;
  businessName: string;
  businessPhone: string;
  status: "yes" | "no" | "other" | "pending";
  price?: number;
  quantity?: number;
  notes?: string;
  distanceKm?: number;
  responseTimeSec?: number;
}

export interface VendorInquiryUpdate {
  inquiryId: string;
  status: "pending" | "partial" | "complete" | "expired";
  vendorCount: number;
  repliedCount: number;
  confirmedCount: number;
  replies: VendorReply[];
}

export interface VendorFeedbackParams {
  inquiryId?: string;
  messageId?: string;
  businessId: string;
  userPhone: string;
  feedbackType: "accurate" | "inaccurate" | "cancelled" | "complaint";
  rating?: number;
  comment?: string;
}

// =====================================================
// TOOL: search_businesses
// =====================================================

/**
 * Search active businesses/vendors using category, tags, and user location.
 * Returns ranked results based on relevance, distance, and vendor quality.
 */
export async function searchBusinesses(
  supabase: SupabaseClient,
  params: BusinessSearchParams,
  correlationId?: string,
): Promise<{ ok: boolean; data?: BusinessSearchResult[]; error?: { code: string; msg: string } }> {
  const startTime = Date.now();

  try {
    logStructuredEvent("VENDOR_SEARCH_START", {
      queryText: params.queryText,
      categories: params.categories,
      tags: params.tags,
      hasLocation: !!(params.userLat && params.userLng),
      correlationId,
    });

    // Call the enhanced search function
    const { data, error } = await supabase.rpc("search_businesses_with_tags", {
      p_query_text: params.queryText || null,
      p_tags: params.tags || null,
      p_category: params.categories?.[0] || null, // Primary category
      p_latitude: params.userLat || null,
      p_longitude: params.userLng || null,
      p_radius_km: params.radiusKm || 10,
      p_limit: params.limit || 10,
    });

    if (error) {
      logStructuredEvent("VENDOR_SEARCH_ERROR", {
        error: error.message,
        correlationId,
      }, "error");
      
      return {
        ok: false,
        error: { code: "SEARCH_FAILED", msg: error.message },
      };
    }

    const results: BusinessSearchResult[] = (data || []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      name: b.name as string,
      category: b.category as string,
      address: b.address as string | undefined,
      phone: b.phone as string | undefined,
      ownerWhatsapp: b.owner_whatsapp as string | undefined,
      tags: b.tags as string[] | undefined,
      metadata: b.metadata as Record<string, unknown> | undefined,
      distanceKm: b.distance_km as number | undefined,
      relevanceScore: b.relevance_score as number | undefined,
      responseRate: b.response_rate as number | undefined,
      responseTimeAvgSec: b.response_time_avg_sec as number | undefined,
    }));

    const duration = Date.now() - startTime;
    logStructuredEvent("VENDOR_SEARCH_COMPLETE", {
      resultCount: results.length,
      durationMs: duration,
      correlationId,
    });

    recordMetric("buy_sell.vendor.search", 1, {
      result_count: results.length,
      duration_ms: duration,
    });

    return { ok: true, data: results };

  } catch (error) {
    const duration = Date.now() - startTime;
    logStructuredEvent("VENDOR_SEARCH_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
      correlationId,
    }, "error");

    return {
      ok: false,
      error: { code: "SEARCH_EXCEPTION", msg: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

// =====================================================
// TOOL: create_vendor_inquiries_and_message_vendors
// =====================================================

/**
 * Create an inquiry record and send WhatsApp messages to selected businesses
 * on behalf of the user. Must only be called after explicit user consent.
 */
export async function createVendorInquiriesAndMessageVendors(
  supabase: SupabaseClient,
  params: VendorInquiryCreateParams,
  sendWhatsAppMessage: (phone: string, message: string) => Promise<{ messageId?: string; error?: string }>,
  correlationId?: string,
): Promise<{ ok: boolean; data?: VendorInquiryResult; error?: { code: string; msg: string } }> {
  const startTime = Date.now();

  try {
    logStructuredEvent("VENDOR_INQUIRY_CREATE_START", {
      userPhone: params.userPhone.slice(-4),
      businessCount: params.businessIds.length,
      requestType: params.requestType,
      correlationId,
    });

    // 1. Create the inquiry record
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

    const { data: inquiry, error: inquiryError } = await supabase
      .from("market_vendor_inquiries")
      .insert({
        user_id: params.userId || null,
        user_phone: params.userPhone,
        request_type: params.requestType,
        request_summary: params.requestSummary,
        request_payload: params.structuredPayload,
        user_lat: params.userLat,
        user_lng: params.userLng,
        vendor_count: params.businessIds.length,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (inquiryError || !inquiry) {
      logStructuredEvent("VENDOR_INQUIRY_CREATE_ERROR", {
        error: inquiryError?.message || "No inquiry returned",
        correlationId,
      }, "error");

      return {
        ok: false,
        error: { code: "INQUIRY_CREATE_FAILED", msg: inquiryError?.message || "Failed to create inquiry" },
      };
    }

    const inquiryId = inquiry.id;

    // 2. Get business details for messaging
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name, phone, owner_whatsapp")
      .in("id", params.businessIds);

    if (!businesses || businesses.length === 0) {
      return {
        ok: false,
        error: { code: "NO_BUSINESSES_FOUND", msg: "No valid businesses found for the given IDs" },
      };
    }

    // 3. Generate and send messages to each vendor
    const vendorIds: string[] = [];
    let messagesSent = 0;

    for (const business of businesses) {
      const vendorPhone = business.owner_whatsapp || business.phone;
      if (!vendorPhone) continue;

      // Generate vendor message
      const message = generateVendorOutreachMessage(params, business.name);

      // Send WhatsApp message
      const sendResult = await sendWhatsAppMessage(vendorPhone, message);

      // Record the outbound message
      await supabase.from("market_vendor_inquiry_messages").insert({
        inquiry_id: inquiryId,
        business_id: business.id,
        business_phone: vendorPhone,
        business_name: business.name,
        direction: "outbound",
        whatsapp_message_id: sendResult.messageId || null,
        body: message,
      });

      if (!sendResult.error) {
        vendorIds.push(business.id);
        messagesSent++;
      }

      logStructuredEvent("VENDOR_MESSAGE_SENT", {
        inquiryId,
        businessId: business.id,
        success: !sendResult.error,
        correlationId,
      });
    }

    const duration = Date.now() - startTime;
    logStructuredEvent("VENDOR_INQUIRY_CREATE_COMPLETE", {
      inquiryId,
      vendorCount: vendorIds.length,
      messagesSent,
      durationMs: duration,
      correlationId,
    });

    recordMetric("buy_sell.vendor.inquiry_created", 1, {
      vendor_count: vendorIds.length,
      messages_sent: messagesSent,
    });

    return {
      ok: true,
      data: {
        inquiryId,
        vendorIds,
        messagesSent,
        expiresAt: expiresAt.toISOString(),
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logStructuredEvent("VENDOR_INQUIRY_CREATE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
      correlationId,
    }, "error");

    return {
      ok: false,
      error: { code: "INQUIRY_EXCEPTION", msg: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

/**
 * Generate a professional vendor outreach message
 */
function generateVendorOutreachMessage(
  params: VendorInquiryCreateParams,
  businessName: string,
): string {
  const payload = params.structuredPayload;
  const lang = params.language || "en";

  // Build the request details
  const details: string[] = [];
  if (payload.item) details.push(payload.item);
  if (payload.quantity) details.push(`Qty: ${payload.quantity}`);
  if (payload.budget) details.push(`Budget: ${payload.budget.toLocaleString()} RWF`);
  if (payload.timeframe) details.push(`When: ${payload.timeframe}`);
  if (payload.brand) details.push(`Brand: ${payload.brand}`);

  const detailsText = details.length > 0 ? details.join("\n") : params.requestSummary;

  if (lang === "rw" || lang === "kinyarwanda") {
    return (
      `Muraho ${businessName},\n\n` +
      `Ndi EasyMO assistant. Umukiriya uri hafi ${payload.pickupArea || "Kigali"} arashaka:\n\n` +
      `${detailsText}\n\n` +
      `Mufite ibi bintu ubu?\n\n` +
      `Subiza:\n` +
      `• YEE igiciro umubare - niba mufite (urugero: YEE 1500 2)\n` +
      `• OYA - niba mudafite`
    );
  }

  // Default English
  return (
    `Hi ${businessName},\n\n` +
    `This is the EasyMO assistant.\n` +
    `A client near ${payload.pickupArea || "your area"} is looking for:\n\n` +
    `${detailsText}\n\n` +
    `Do you have this in stock right now?\n\n` +
    `Please reply:\n` +
    `• YES price quantity – if you have it (e.g., YES 1500 2)\n` +
    `• NO – if you don't have it`
  );
}

// =====================================================
// TOOL: get_vendor_inquiry_updates
// =====================================================

/**
 * Check replies from vendors and interpret if they have the requested item.
 * Returns structured list of responses for the agent to summarize.
 */
export async function getVendorInquiryUpdates(
  supabase: SupabaseClient,
  inquiryId: string,
  correlationId?: string,
): Promise<{ ok: boolean; data?: VendorInquiryUpdate; error?: { code: string; msg: string } }> {
  try {
    logStructuredEvent("VENDOR_INQUIRY_UPDATE_START", {
      inquiryId,
      correlationId,
    });

    // 1. Get the inquiry
    const { data: inquiry, error: inquiryError } = await supabase
      .from("market_vendor_inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiry) {
      return {
        ok: false,
        error: { code: "INQUIRY_NOT_FOUND", msg: "Inquiry not found" },
      };
    }

    // 2. Get all messages for this inquiry
    const { data: messages } = await supabase
      .from("market_vendor_inquiry_messages")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    // 3. Group messages by business and determine status
    const businessReplies = new Map<string, VendorReply>();

    for (const msg of messages || []) {
      const businessId = msg.business_id;
      if (!businessId) continue;

      // Initialize with outbound message info
      if (msg.direction === "outbound") {
        if (!businessReplies.has(businessId)) {
          businessReplies.set(businessId, {
            businessId,
            businessName: msg.business_name || "Unknown",
            businessPhone: msg.business_phone,
            status: "pending",
          });
        }
      }

      // Update with inbound reply
      if (msg.direction === "inbound") {
        const existing = businessReplies.get(businessId);
        if (existing) {
          existing.status = msg.parsed_status || "other";
          existing.price = msg.price || undefined;
          existing.quantity = msg.quantity || undefined;
          existing.notes = msg.notes || undefined;
          existing.responseTimeSec = msg.response_time_sec || undefined;
        }
      }
    }

    // 4. Get distance info from businesses table
    const businessIds = Array.from(businessReplies.keys());
    if (businessIds.length > 0 && inquiry.user_lat && inquiry.user_lng) {
      const { data: businesses } = await supabase.rpc("search_businesses_with_tags", {
        p_tags: null,
        p_category: null,
        p_latitude: inquiry.user_lat,
        p_longitude: inquiry.user_lng,
        p_radius_km: 50,
        p_limit: 100,
      });

      if (businesses) {
        for (const biz of businesses) {
          const reply = businessReplies.get(biz.id);
          if (reply && biz.distance_km) {
            reply.distanceKm = biz.distance_km;
          }
        }
      }
    }

    // 5. Build response
    const replies = Array.from(businessReplies.values());
    const repliedCount = replies.filter((r) => r.status !== "pending").length;
    const confirmedCount = replies.filter((r) => r.status === "yes").length;

    // Determine overall status
    let status: "pending" | "partial" | "complete" | "expired" = inquiry.status;
    if (new Date(inquiry.expires_at) < new Date()) {
      status = "expired";
    } else if (repliedCount === inquiry.vendor_count) {
      status = "complete";
    } else if (repliedCount > 0) {
      status = "partial";
    }

    // Update inquiry status if changed
    if (status !== inquiry.status) {
      await supabase
        .from("market_vendor_inquiries")
        .update({
          status,
          replied_count: repliedCount,
          confirmed_count: confirmedCount,
          completed_at: status === "complete" ? new Date().toISOString() : null,
        })
        .eq("id", inquiryId);
    }

    logStructuredEvent("VENDOR_INQUIRY_UPDATE_COMPLETE", {
      inquiryId,
      status,
      vendorCount: inquiry.vendor_count,
      repliedCount,
      confirmedCount,
      correlationId,
    });

    return {
      ok: true,
      data: {
        inquiryId,
        status,
        vendorCount: inquiry.vendor_count,
        repliedCount,
        confirmedCount,
        replies,
      },
    };

  } catch (error) {
    logStructuredEvent("VENDOR_INQUIRY_UPDATE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      inquiryId,
      correlationId,
    }, "error");

    return {
      ok: false,
      error: { code: "UPDATE_EXCEPTION", msg: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

// =====================================================
// TOOL: process_vendor_reply
// =====================================================

/**
 * Process an inbound WhatsApp message from a vendor.
 * Parses "YES price quantity" or "NO" format and updates the inquiry.
 */
export async function processVendorReply(
  supabase: SupabaseClient,
  vendorPhone: string,
  messageBody: string,
  whatsappMessageId?: string,
  correlationId?: string,
): Promise<{ ok: boolean; data?: { inquiryId: string; parsed: boolean }; error?: { code: string; msg: string } }> {
  try {
    logStructuredEvent("VENDOR_REPLY_PROCESS_START", {
      vendorPhone: vendorPhone.slice(-4),
      messageLength: messageBody.length,
      correlationId,
    });

    // 1. Find the most recent pending inquiry for this vendor
    const { data: outboundMessages } = await supabase
      .from("market_vendor_inquiry_messages")
      .select("*, market_vendor_inquiries!inner(*)")
      .eq("business_phone", vendorPhone)
      .eq("direction", "outbound")
      .eq("market_vendor_inquiries.status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!outboundMessages || outboundMessages.length === 0) {
      // Check for partial status inquiries too
      const { data: partialMessages } = await supabase
        .from("market_vendor_inquiry_messages")
        .select("*, market_vendor_inquiries!inner(*)")
        .eq("business_phone", vendorPhone)
        .eq("direction", "outbound")
        .eq("market_vendor_inquiries.status", "partial")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!partialMessages || partialMessages.length === 0) {
        return {
          ok: false,
          error: { code: "NO_PENDING_INQUIRY", msg: "No pending inquiry found for this vendor" },
        };
      }

      // Use partial inquiry
      return processReplyForMessage(supabase, partialMessages[0], messageBody, whatsappMessageId, correlationId);
    }

    return processReplyForMessage(supabase, outboundMessages[0], messageBody, whatsappMessageId, correlationId);

  } catch (error) {
    logStructuredEvent("VENDOR_REPLY_PROCESS_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      vendorPhone: vendorPhone.slice(-4),
      correlationId,
    }, "error");

    return {
      ok: false,
      error: { code: "REPLY_EXCEPTION", msg: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function processReplyForMessage(
  supabase: SupabaseClient,
  outboundMessage: Record<string, unknown>,
  messageBody: string,
  whatsappMessageId?: string,
  correlationId?: string,
): Promise<{ ok: boolean; data?: { inquiryId: string; parsed: boolean }; error?: { code: string; msg: string } }> {
  const inquiry = outboundMessage.market_vendor_inquiries as Record<string, unknown>;
  const inquiryId = inquiry.id as string;
  const outboundTime = new Date(outboundMessage.created_at as string);

  // 2. Parse the vendor's response
  const parsed = parseVendorResponse(messageBody);

  // Calculate response time
  const responseTimeSec = Math.round((Date.now() - outboundTime.getTime()) / 1000);

  // 3. Insert the inbound message
  await supabase.from("market_vendor_inquiry_messages").insert({
    inquiry_id: inquiryId,
    business_id: outboundMessage.business_id,
    business_phone: outboundMessage.business_phone,
    business_name: outboundMessage.business_name,
    direction: "inbound",
    whatsapp_message_id: whatsappMessageId || null,
    body: messageBody,
    parsed_status: parsed.status,
    price: parsed.price,
    quantity: parsed.quantity,
    notes: parsed.notes,
    response_time_sec: responseTimeSec,
  });

  // 4. Update vendor metrics
  if (outboundMessage.business_id) {
    await supabase.rpc("update_vendor_metrics", {
      p_business_id: outboundMessage.business_id,
    });
  }

  logStructuredEvent("VENDOR_REPLY_PROCESSED", {
    inquiryId,
    businessId: outboundMessage.business_id,
    parsedStatus: parsed.status,
    responseTimeSec,
    correlationId,
  });

  recordMetric("buy_sell.vendor.reply_processed", 1, {
    status: parsed.status,
  });

  return {
    ok: true,
    data: {
      inquiryId,
      parsed: parsed.status !== "other",
    },
  };
}

/**
 * Parse vendor response text into structured data.
 * Supports formats like:
 * - "YES 1500 2" → yes, price=1500, quantity=2
 * - "YEE 1500" → yes, price=1500
 * - "NO" → no
 * - "OYA" → no (Kinyarwanda)
 */
function parseVendorResponse(text: string): {
  status: "yes" | "no" | "other";
  price?: number;
  quantity?: number;
  notes?: string;
} {
  const normalized = text.trim().toLowerCase();

  // Check for negative responses
  if (/^(no|oya|nope|sorry|don't have|hatubifite|nta)/i.test(normalized)) {
    return { status: "no" };
  }

  // Check for positive responses
  const yesMatch = normalized.match(/^(yes|yee|yeah|ndabifite|tubifite)\s*([\d,.]+)?\s*([\d,.]+)?/i);
  if (yesMatch) {
    const price = yesMatch[2] ? parseFloat(yesMatch[2].replace(/,/g, "")) : undefined;
    const quantity = yesMatch[3] ? parseInt(yesMatch[3].replace(/,/g, ""), 10) : undefined;

    return {
      status: "yes",
      price: price && !isNaN(price) ? price : undefined,
      quantity: quantity && !isNaN(quantity) ? quantity : undefined,
    };
  }

  // Check if message contains numbers (might be price/availability info)
  const numberMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (numberMatch && numberMatch.length > 0) {
    return {
      status: "other",
      notes: text.slice(0, 200),
    };
  }

  return { status: "other", notes: text.slice(0, 200) };
}

// =====================================================
// TOOL: log_user_feedback_on_vendor
// =====================================================

/**
 * Log user feedback after they visit a vendor.
 * Used to update vendor reliability scores.
 */
export async function logUserFeedbackOnVendor(
  supabase: SupabaseClient,
  params: VendorFeedbackParams,
  correlationId?: string,
): Promise<{ ok: boolean; error?: { code: string; msg: string } }> {
  try {
    logStructuredEvent("VENDOR_FEEDBACK_START", {
      businessId: params.businessId,
      feedbackType: params.feedbackType,
      correlationId,
    });

    // Insert feedback
    const { error } = await supabase.from("market_vendor_feedback").insert({
      inquiry_id: params.inquiryId || null,
      message_id: params.messageId || null,
      business_id: params.businessId,
      user_phone: params.userPhone,
      feedback_type: params.feedbackType,
      rating: params.rating || null,
      comment: params.comment || null,
    });

    if (error) {
      return {
        ok: false,
        error: { code: "FEEDBACK_INSERT_FAILED", msg: error.message },
      };
    }

    // Update vendor metrics
    await supabase.rpc("update_vendor_metrics", {
      p_business_id: params.businessId,
    });

    logStructuredEvent("VENDOR_FEEDBACK_RECORDED", {
      businessId: params.businessId,
      feedbackType: params.feedbackType,
      correlationId,
    });

    recordMetric("buy_sell.vendor.feedback", 1, {
      type: params.feedbackType,
    });

    return { ok: true };

  } catch (error) {
    logStructuredEvent("VENDOR_FEEDBACK_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");

    return {
      ok: false,
      error: { code: "FEEDBACK_EXCEPTION", msg: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

// =====================================================
// HELPER: Format vendor shortlist for user
// =====================================================

/**
 * Format confirmed vendor replies into a user-friendly message
 */
export function formatVendorShortlist(
  replies: VendorReply[],
  requestSummary: string,
): string {
  const confirmed = replies.filter((r) => r.status === "yes");

  if (confirmed.length === 0) {
    const pending = replies.filter((r) => r.status === "pending").length;
    if (pending > 0) {
      return (
        `⏳ *Still Waiting for Replies*\n\n` +
        `I've contacted ${replies.length} businesses about:\n` +
        `"${requestSummary}"\n\n` +
        `${pending} haven't replied yet. Check back in a minute!`
      );
    }

    return (
      `😔 *No Matches Found*\n\n` +
      `None of the ${replies.length} businesses I contacted have "${requestSummary}" in stock right now.\n\n` +
      `Would you like me to:\n` +
      `• Search a wider area\n` +
      `• Try different businesses\n` +
      `• Show the directory anyway`
    );
  }

  let message = `✅ *${confirmed.length} Business${confirmed.length > 1 ? "es" : ""} Confirmed*\n\n`;
  message += `These have "${requestSummary}" right now:\n\n`;

  confirmed.forEach((vendor, index) => {
    message += `${index + 1}. *${vendor.businessName}*`;
    if (vendor.distanceKm) {
      message += ` – ${vendor.distanceKm.toFixed(1)}km away`;
    }
    message += "\n";

    if (vendor.price) {
      message += `   💰 ${vendor.price.toLocaleString()} RWF`;
      if (vendor.quantity) {
        message += ` (${vendor.quantity} available)`;
      }
      message += "\n";
    }

    if (vendor.notes) {
      message += `   📝 ${vendor.notes}\n`;
    }

    message += "\n";
  });

  message += `\n📞 Tap to chat directly:\n`;
  confirmed.forEach((vendor, index) => {
    const cleanPhone = vendor.businessPhone.replace(/\D/g, "");
    message += `[Chat ${vendor.businessName}](https://wa.me/${cleanPhone})\n`;
  });

  return message;
}
