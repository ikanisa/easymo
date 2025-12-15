/**
 * Vendor Response Handler
 * 
 * Handles incoming messages from vendors responding to agent inquiries.
 * Routes vendor responses to the outreach service for processing.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import { VendorOutreachService } from "../services/vendor-outreach.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

// =====================================================
// VENDOR RESPONSE HANDLER
// =====================================================

export class VendorResponseHandler {
  private supabase: SupabaseClient;
  private correlationId?: string;

  constructor(supabase: SupabaseClient, correlationId?: string) {
    this.supabase = supabase;
    this.correlationId = correlationId;
  }

  /**
   * Check if a message is from a vendor responding to an agent inquiry
   */
  async isVendorResponse(vendorPhone: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from("agent_vendor_messages")
        .select("id")
        .eq("vendor_phone", vendorPhone)
        .eq("response_status", "pending")
        .limit(1)
        .single();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Process a vendor response message
   */
  async handleVendorResponse(params: {
    vendorPhone: string;
    message: string;
  }): Promise<{
    success: boolean;
    shouldNotifyUser: boolean;
    sessionId?: string;
    error?: string;
  }> {
    try {
      const outreachService = new VendorOutreachService(
        this.supabase,
        this.correlationId
      );

      // Process the vendor response
      const result = await outreachService.processVendorResponse({
        vendorPhone: params.vendorPhone,
        message: params.message,
      });

      if (!result.success) {
        return {
          success: false,
          shouldNotifyUser: false,
          error: result.error,
        };
      }

      // Check if session is completed (all vendors responded or deadline passed)
      const session = await outreachService.getSession(result.sessionId!);

      logStructuredEvent("VENDOR_RESPONSE_HANDLED", {
        vendorPhone: params.vendorPhone.slice(-4),
        sessionId: result.sessionId,
        sessionStatus: session?.status,
        correlationId: this.correlationId,
      });

      return {
        success: true,
        shouldNotifyUser: session?.status === "completed",
        sessionId: result.sessionId,
      };
    } catch (error) {
      logStructuredEvent(
        "VENDOR_RESPONSE_HANDLER_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          vendorPhone: params.vendorPhone.slice(-4),
          correlationId: this.correlationId,
        },
        "error"
      );

      return {
        success: false,
        shouldNotifyUser: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Format notification message to user with vendor responses
   */
  async formatUserNotification(sessionId: string): Promise<string | null> {
    try {
      const outreachService = new VendorOutreachService(
        this.supabase,
        this.correlationId
      );

      const session = await outreachService.getSession(sessionId);
      if (!session) {
        return null;
      }

      const vendorResponses = await outreachService.getVendorResponses(sessionId);

      // Filter for positive responses (vendors who have the items)
      const positiveResponses = vendorResponses.filter((r) => r.has_items);
      const negativeResponses = vendorResponses.filter((r) => !r.has_items);
      const timedOutCount = (session.vendors_contacted?.length || 0) - vendorResponses.length;

      let message = "";

      if (positiveResponses.length === 0) {
        // No vendors have the items
        message = `😔 *Update on Your Request*\n\n`;
        message += `Unfortunately, none of the ${session.vendors_contacted?.length || 0} pharmacies I contacted have all the items you're looking for.\n\n`;

        if (negativeResponses.length > 0) {
          message += `${negativeResponses.length} pharmacy(ies) confirmed they don't have the items.\n`;
        }

        if (timedOutCount > 0) {
          message += `${timedOutCount} pharmacy(ies) didn't respond in time.\n`;
        }

        message += `\nWould you like me to:\n`;
        message += `1️⃣ Try a wider search area\n`;
        message += `2️⃣ Show you all pharmacies so you can check yourself\n`;
        message += `3️⃣ Notify you when these items become available`;
      } else {
        // At least one vendor has the items
        message = `✅ *Good news!* ${positiveResponses.length} pharmacy(ies) confirmed they have your items:\n\n`;

        positiveResponses.forEach((response, i) => {
          const emojiNumbers = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
          message += `${emojiNumbers[i] || `${i + 1}.`} *${response.vendor_name}*\n`;

          // Show pricing if available
          if (response.price_quoted && Object.keys(response.price_quoted).length > 0) {
            const totalPrice = Object.values(response.price_quoted).reduce(
              (sum, price) => sum + (price as number),
              0
            );
            message += `   💰 Total: ${totalPrice.toLocaleString()} RWF\n`;
          }

          // Show response time
          if (response.response_time_seconds) {
            const minutes = Math.floor(response.response_time_seconds / 60);
            message += `   ⏱️ Responded in ${minutes} min\n`;
          }

          // Show availability details if provided
          if (response.availability_details) {
            const details = response.availability_details.substring(0, 100);
            message += `   📝 ${details}${response.availability_details.length > 100 ? "..." : ""}\n`;
          }

          message += `\n`;
        });

        if (negativeResponses.length > 0 || timedOutCount > 0) {
          message += `❌ `;
          if (negativeResponses.length > 0) {
            message += `${negativeResponses.length} pharmacy(ies) don't have the items`;
          }
          if (timedOutCount > 0) {
            if (negativeResponses.length > 0) message += `, `;
            message += `${timedOutCount} didn't respond in time`;
          }
          message += `\n\n`;
        }

        message += `📞 _Reply with a number (1-${positiveResponses.length}) to get contact details and directions!_\n`;
        message += `🔄 _Type *menu* to search for more businesses_`;
      }

      return message;
    } catch (error) {
      logStructuredEvent(
        "VENDOR_RESPONSE_FORMAT_NOTIFICATION_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          sessionId,
          correlationId: this.correlationId,
        },
        "error"
      );
      return null;
    }
  }

  /**
   * Send notification to user about completed outreach session
   */
  async notifyUser(params: {
    sessionId: string;
    userPhone: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const message = await this.formatUserNotification(params.sessionId);

      if (!message) {
        return { success: false, error: "Failed to format notification" };
      }

      // Send WhatsApp message directly to user using their phone number
      await sendText(params.userPhone, message);
      
      logStructuredEvent("BUY_SELL_VENDOR_RESPONSE_SENT", {
        userPhone: params.userPhone.slice(-4),
        sessionId: params.sessionId,
        correlationId: this.correlationId,
      });
      
      await recordMetric("buy_sell.vendor_response.sent", 1);

      logStructuredEvent("VENDOR_RESPONSE_USER_NOTIFIED", {
        sessionId: params.sessionId,
        userPhone: params.userPhone.slice(-4),
        correlationId: this.correlationId,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
