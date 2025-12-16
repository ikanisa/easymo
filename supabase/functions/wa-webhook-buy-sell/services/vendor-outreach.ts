/**
 * Vendor Outreach Service
 *
 * Handles proactive outreach to vendors on behalf of users.
 * Sends WhatsApp messages to vendors and tracks responses.
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import {
  logStructuredEvent,
  recordMetric,
} from "../../_shared/observability.ts";

// =====================================================
// TYPES
// =====================================================

export interface OutreachSession {
  id: string;
  user_phone: string;
  agent_type: string;
  request_summary: string;
  items_requested: Array<{
    name: string;
    quantity?: number;
    dosage?: string;
    attributes?: Record<string, unknown>;
  }>;
  user_location?: { lat: number; lng: number; text?: string };
  status: OutreachSessionStatus;
  vendors_contacted: string[];
  vendor_responses: VendorResponse[];
  response_deadline?: string;
  final_recommendations?: unknown;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export type OutreachSessionStatus =
  | "gathering_info"
  | "awaiting_user_consent"
  | "contacting_vendors"
  | "collecting_responses"
  | "completed"
  | "expired"
  | "cancelled";

export interface VendorResponse {
  vendor_id?: string;
  vendor_phone: string;
  vendor_name: string;
  has_items: boolean;
  price_quoted?: Record<string, number>;
  availability_details?: string;
  response_time_seconds?: number;
}

export interface Vendor {
  id?: string;
  name: string;
  phone?: string;
  category?: string;
  city?: string;
  address?: string;
  distance_km?: number;
  avg_response_time_minutes?: number;
  accepts_agent_inquiries?: boolean;
  agent_inquiry_phone?: string;
}

// =====================================================
// CONFIGURATION
// =====================================================

const RESPONSE_TIMEOUT_MINUTES = 5;
const MAX_VENDORS_TO_CONTACT = 10;

// =====================================================
// VENDOR OUTREACH SERVICE
// =====================================================

export class VendorOutreachService {
  private supabase: SupabaseClient;
  private correlationId?: string;

  constructor(supabase: SupabaseClient, correlationId?: string) {
    this.supabase = supabase;
    this.correlationId = correlationId;
  }

  /**
   * Create a new outreach session
   */
  async createSession(params: {
    userPhone: string;
    requestSummary: string;
    itemsRequested: Array<{
      name: string;
      quantity?: number;
      dosage?: string;
      attributes?: Record<string, unknown>;
    }>;
    userLocation?: { lat: number; lng: number; text?: string };
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from("agent_outreach_sessions")
        .insert({
          user_phone: params.userPhone,
          agent_type: "buy_sell",
          request_summary: params.requestSummary,
          items_requested: params.itemsRequested,
          user_location: params.userLocation,
          status: "gathering_info",
        })
        .select("id")
        .single();

      if (error) {
        logStructuredEvent(
          "VENDOR_OUTREACH_CREATE_SESSION_ERROR",
          {
            error: error.message,
            userPhone: params.userPhone.slice(-4),
            correlationId: this.correlationId,
          },
          "error",
        );
        return { success: false, error: error.message };
      }

      logStructuredEvent("VENDOR_OUTREACH_SESSION_CREATED", {
        sessionId: data.id,
        userPhone: params.userPhone.slice(-4),
        itemCount: params.itemsRequested.length,
        correlationId: this.correlationId,
      });

      recordMetric("vendor.outreach.session.created", 1);

      return { success: true, sessionId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: OutreachSessionStatus,
    additionalData?: {
      final_recommendations?: unknown;
      completed_at?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = { status };
      if (additionalData?.final_recommendations) {
        updateData.final_recommendations = additionalData.final_recommendations;
      }
      if (additionalData?.completed_at || status === "completed") {
        updateData.completed_at = additionalData?.completed_at ||
          new Date().toISOString();
      }

      const { error } = await this.supabase
        .from("agent_outreach_sessions")
        .update(updateData)
        .eq("id", sessionId);

      if (error) {
        logStructuredEvent(
          "VENDOR_OUTREACH_UPDATE_SESSION_ERROR",
          {
            error: error.message,
            sessionId,
            status,
            correlationId: this.correlationId,
          },
          "error",
        );
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Find suitable vendors based on items and location
   */
  async findVendors(params: {
    category: string;
    location?: { lat: number; lng: number };
    limit?: number;
  }): Promise<Vendor[]> {
    try {
      const limit = Math.min(
        params.limit || MAX_VENDORS_TO_CONTACT,
        MAX_VENDORS_TO_CONTACT,
      );

      // If we have location, search nearby businesses
      if (params.location) {
        const { data: businesses } = await this.supabase.rpc(
          "search_businesses_nearby",
          {
            search_term: params.category,
            user_lat: params.location.lat,
            user_lng: params.location.lng,
            radius_km: 10,
            result_limit: limit,
          },
        );

        if (businesses && businesses.length > 0) {
          return businesses.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: b.name as string,
            phone: b.phone as string,
            category: b.category as string,
            city: b.city as string,
            address: b.address as string,
            distance_km: b.distance_km as number,
            avg_response_time_minutes: b.avg_response_time_minutes as number,
            accepts_agent_inquiries: b.accepts_agent_inquiries !== false,
            agent_inquiry_phone: b.agent_inquiry_phone as string,
          }));
        }
      }

      // Fallback: search by category without location
      const { data: businesses } = await this.supabase
        .from("businesses")
        .select(
          "id, name, phone, category, city, address, avg_response_time_minutes, accepts_agent_inquiries, agent_inquiry_phone",
        )
        .ilike("category", `%${params.category}%`)
        .eq("accepts_agent_inquiries", true)
        .limit(limit);

      if (businesses && businesses.length > 0) {
        return businesses.map((b) => ({
          id: b.id,
          name: b.name,
          phone: b.phone || b.agent_inquiry_phone,
          category: b.category,
          city: b.city,
          address: b.address,
          avg_response_time_minutes: b.avg_response_time_minutes,
          accepts_agent_inquiries: b.accepts_agent_inquiries,
          agent_inquiry_phone: b.agent_inquiry_phone,
        }));
      }

      return [];
    } catch (error) {
      logStructuredEvent(
        "VENDOR_OUTREACH_FIND_VENDORS_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          category: params.category,
          correlationId: this.correlationId,
        },
        "error",
      );
      return [];
    }
  }

  /**
   * Contact vendors via WhatsApp
   */
  async contactVendors(params: {
    sessionId: string;
    vendors: Vendor[];
    items: Array<{ name: string; quantity?: number; dosage?: string }>;
  }): Promise<{ success: boolean; contacted: number; error?: string }> {
    try {
      const responseDeadline = new Date(
        Date.now() + RESPONSE_TIMEOUT_MINUTES * 60 * 1000,
      );

      // Update session status and deadline
      await this.supabase
        .from("agent_outreach_sessions")
        .update({
          status: "contacting_vendors",
          response_deadline: responseDeadline.toISOString(),
          vendors_contacted: params.vendors.map((v) => v.id).filter(
            Boolean,
          ) as string[],
        })
        .eq("id", params.sessionId);

      // Format items list
      const itemsList = params.items
        .map((item, i) => {
          let line = `${i + 1}. ${item.name}`;
          if (item.dosage) line += ` ${item.dosage}`;
          if (item.quantity) line += ` x ${item.quantity}`;
          return line;
        })
        .join("\n");

      let contactedCount = 0;

      // Send message to each vendor
      for (const vendor of params.vendors) {
        const vendorPhone = vendor.agent_inquiry_phone || vendor.phone;
        if (!vendorPhone) continue;

        const message = this.formatVendorInquiryMessage(
          vendor.name,
          itemsList,
          params.sessionId,
        );

        // Record the outgoing message
        const { error: messageError } = await this.supabase
          .from("agent_vendor_messages")
          .insert({
            outreach_session_id: params.sessionId,
            vendor_id: vendor.id,
            vendor_phone: vendorPhone,
            message_sent: message,
            message_sent_at: new Date().toISOString(),
            response_status: "pending",
          });

        if (messageError) {
          logStructuredEvent(
            "VENDOR_OUTREACH_MESSAGE_RECORD_ERROR",
            {
              error: messageError.message,
              vendorPhone: vendorPhone.slice(-4),
              correlationId: this.correlationId,
            },
            "error",
          );
          continue;
        }

        // Send WhatsApp message via Cloud API
        try {
          const { sendText } = await import(
            "../../_shared/wa-webhook-shared/wa/client.ts"
          );
          await sendText(vendorPhone, message);

          logStructuredEvent("VENDOR_OUTREACH_WHATSAPP_SENT", {
            sessionId: params.sessionId,
            vendorPhone: vendorPhone.slice(-4),
            messageLength: message.length,
            correlationId: this.correlationId,
          });
        } catch (sendError) {
          logStructuredEvent(
            "VENDOR_OUTREACH_WHATSAPP_FAILED",
            {
              error: sendError instanceof Error
                ? sendError.message
                : String(sendError),
              vendorPhone: vendorPhone.slice(-4),
              correlationId: this.correlationId,
            },
            "error",
          );
          // Continue anyway - message is recorded in DB for retry
        }

        contactedCount++;
      }

      // Update to collecting_responses status
      if (contactedCount > 0) {
        await this.updateSessionStatus(
          params.sessionId,
          "collecting_responses",
        );
      }

      logStructuredEvent("VENDOR_OUTREACH_MESSAGES_SENT", {
        sessionId: params.sessionId,
        contactedCount,
        totalVendors: params.vendors.length,
        correlationId: this.correlationId,
      });

      recordMetric("vendor.outreach.messages.sent", contactedCount);

      return { success: true, contacted: contactedCount };
    } catch (error) {
      return {
        success: false,
        contacted: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Format vendor inquiry message
   */
  private formatVendorInquiryMessage(
    vendorName: string,
    itemsList: string,
    sessionId: string,
  ): string {
    return `Hello ${vendorName}!

A customer near your location is looking for:
${itemsList}

Do you have these items in stock?
Please reply with:
✅ YES - [prices]
❌ NO

Reference: ${sessionId.slice(0, 8)}`;
  }

  /**
   * Process vendor response
   */
  async processVendorResponse(params: {
    vendorPhone: string;
    message: string;
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Find the pending message for this vendor
      const { data: vendorMessage } = await this.supabase
        .from("agent_vendor_messages")
        .select("id, outreach_session_id, message_sent_at, vendor_id")
        .eq("vendor_phone", params.vendorPhone)
        .eq("response_status", "pending")
        .order("message_sent_at", { ascending: false })
        .limit(1)
        .single();

      if (!vendorMessage) {
        // No pending inquiry from this vendor
        return { success: false, error: "No pending inquiry found" };
      }

      // Parse response to extract availability and pricing
      const parsed = this.parseVendorResponse(params.message);

      // Calculate response time
      const responseTimeSeconds = Math.floor(
        (Date.now() - new Date(vendorMessage.message_sent_at).getTime()) / 1000,
      );

      // Update vendor message record
      await this.supabase
        .from("agent_vendor_messages")
        .update({
          response_received: params.message,
          response_received_at: new Date().toISOString(),
          has_items: parsed.hasItems,
          price_quoted: parsed.prices,
          availability_details: parsed.details,
          response_status: "received",
        })
        .eq("id", vendorMessage.id);

      // Update vendor reliability
      await this.supabase.rpc("update_vendor_reliability", {
        p_vendor_phone: params.vendorPhone,
        p_vendor_id: vendorMessage.vendor_id,
        p_has_response: true,
        p_response_time_seconds: responseTimeSeconds,
      });

      logStructuredEvent("VENDOR_OUTREACH_RESPONSE_RECEIVED", {
        sessionId: vendorMessage.outreach_session_id,
        vendorPhone: params.vendorPhone.slice(-4),
        hasItems: parsed.hasItems,
        responseTimeSeconds,
        correlationId: this.correlationId,
      });

      recordMetric("vendor.outreach.response.received", 1, {
        has_items: parsed.hasItems,
      });

      // Check if all vendors have responded or deadline passed
      await this.checkSessionCompletion(vendorMessage.outreach_session_id);

      return {
        success: true,
        sessionId: vendorMessage.outreach_session_id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse vendor response to extract availability and pricing
   */
  private parseVendorResponse(message: string): {
    hasItems: boolean;
    prices?: Record<string, number>;
    details?: string;
  } {
    const normalizedMessage = message.toLowerCase().trim();

    // Check for clear YES/NO
    const hasYes = normalizedMessage.includes("yes") ||
      normalizedMessage.includes("✅");
    const hasNo = normalizedMessage.includes("no") ||
      normalizedMessage.includes("❌");

    if (hasNo && !hasYes) {
      return { hasItems: false, details: message };
    }

    if (hasYes) {
      // Try to extract prices
      const priceRegex = /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rwf|frw|rf)?/gi;
      const prices: Record<string, number> = {};
      let match;
      let index = 0;

      while ((match = priceRegex.exec(message)) !== null) {
        const price = parseFloat(match[1].replace(/,/g, ""));
        prices[`item_${index}`] = price;
        index++;
      }

      return {
        hasItems: true,
        prices: Object.keys(prices).length > 0 ? prices : undefined,
        details: message,
      };
    }

    // Ambiguous response - default to has items if it contains numbers (might be prices)
    const hasNumbers = /\d/.test(message);
    return {
      hasItems: hasNumbers,
      details: message,
    };
  }

  /**
   * Check if outreach session is complete
   */
  private async checkSessionCompletion(sessionId: string): Promise<void> {
    try {
      // Get session and all vendor messages
      const { data: session } = await this.supabase
        .from("agent_outreach_sessions")
        .select("*, response_deadline, user_phone")
        .eq("id", sessionId)
        .single();

      if (!session || session.status === "completed") {
        return;
      }

      const { data: messages } = await this.supabase
        .from("agent_vendor_messages")
        .select("*")
        .eq("outreach_session_id", sessionId);

      if (!messages || messages.length === 0) {
        return;
      }

      const pendingCount = messages.filter((m) =>
        m.response_status === "pending"
      ).length;
      const now = new Date();
      const deadline = session.response_deadline
        ? new Date(session.response_deadline)
        : null;

      // Complete if all responded or deadline passed
      if (pendingCount === 0 || (deadline && now > deadline)) {
        // Mark timed-out messages
        if (deadline && now > deadline) {
          const pendingMessages = messages.filter((m) =>
            m.response_status === "pending"
          );
          for (const msg of pendingMessages) {
            await this.supabase
              .from("agent_vendor_messages")
              .update({ response_status: "timeout" })
              .eq("id", msg.id);

            // Update vendor reliability for timeout
            await this.supabase.rpc("update_vendor_reliability", {
              p_vendor_phone: msg.vendor_phone,
              p_vendor_id: msg.vendor_id,
              p_has_response: false,
              p_response_time_seconds: null,
            });
          }
        }

        // Get final recommendations (vendors with positive responses)
        const positiveResponses = messages
          .filter((m) => m.response_status === "received" && m.has_items)
          .map((m) => ({
            vendor_phone: m.vendor_phone,
            vendor_id: m.vendor_id,
            price_quoted: m.price_quoted,
            availability_details: m.availability_details,
          }));

        await this.updateSessionStatus(sessionId, "completed", {
          final_recommendations: positiveResponses,
        });

        // Notify user of results
        try {
          const { VendorResponseHandler } = await import(
            "../handlers/vendor-response-handler.ts"
          );
          const handler = new VendorResponseHandler(
            this.supabase,
            this.correlationId,
          );
          await handler.notifyUser({
            sessionId,
            userPhone: session.user_phone,
          });
        } catch (notifyError) {
          // Log but don't fail - notification is best effort
          logStructuredEvent("VENDOR_OUTREACH_NOTIFY_USER_FAILED", {
            error: notifyError instanceof Error
              ? notifyError.message
              : String(notifyError),
            sessionId,
            userPhone: session.user_phone,
          }, "warn");
        }

        logStructuredEvent("VENDOR_OUTREACH_SESSION_COMPLETED", {
          sessionId,
          totalVendors: messages.length,
          positiveResponses: positiveResponses.length,
          correlationId: this.correlationId,
        });

        recordMetric("vendor.outreach.session.completed", 1, {
          positive_responses: positiveResponses.length,
          total_vendors: messages.length,
        });
      }
    } catch (error) {
      logStructuredEvent(
        "VENDOR_OUTREACH_CHECK_COMPLETION_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          sessionId,
          correlationId: this.correlationId,
        },
        "error",
      );
    }
  }

  /**
   * Get session status and results
   */
  async getSession(sessionId: string): Promise<OutreachSession | null> {
    try {
      const { data, error } = await this.supabase
        .from("agent_outreach_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as OutreachSession;
    } catch {
      return null;
    }
  }

  /**
   * Get vendor responses for a session
   */
  async getVendorResponses(sessionId: string): Promise<VendorResponse[]> {
    try {
      const { data: messages } = await this.supabase
        .from("agent_vendor_messages")
        .select("*, businesses(name)")
        .eq("outreach_session_id", sessionId)
        .eq("response_status", "received");

      if (!messages || messages.length === 0) {
        return [];
      }

      return messages.map((m) => ({
        vendor_id: m.vendor_id,
        vendor_phone: m.vendor_phone,
        vendor_name: m.businesses?.name || "Unknown Vendor",
        has_items: m.has_items || false,
        price_quoted: m.price_quoted,
        availability_details: m.availability_details,
        response_time_seconds: m.response_received_at && m.message_sent_at
          ? Math.floor(
            (new Date(m.response_received_at).getTime() -
              new Date(m.message_sent_at).getTime()) /
              1000,
          )
          : undefined,
      }));
    } catch {
      return [];
    }
  }
}
