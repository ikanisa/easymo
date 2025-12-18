/**
 * Vendor Response Notification Handler
 * 
 * Sends notifications to users when vendors respond to broadcast messages.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "./observability.ts";
import { sendText } from "./wa-webhook-shared/wa/client.ts";

interface VendorReply {
  id: string;
  business_phone: string;
  raw_body: string;
  action: "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES" | "UNKNOWN" | null;
  has_stock: boolean | null;
  broadcast_target_id: string | null;
  created_at: string;
}

/**
 * Notify user of vendor response
 * 
 * @param supabase - Supabase client
 * @param reply - Vendor reply record
 * @param correlationId - Correlation ID for logging
 */
export async function notifyUserOfVendorResponse(
  supabase: SupabaseClient,
  reply: VendorReply,
  correlationId?: string
): Promise<void> {
  try {
    // Get broadcast target to find the broadcast request
    if (!reply.broadcast_target_id) {
      logStructuredEvent("VENDOR_RESPONSE_NO_BROADCAST_TARGET", {
        replyId: reply.id,
        correlationId,
      }, "warn");
      return;
    }

    const { data: target, error: targetError } = await supabase
      .from("whatsapp_broadcast_targets")
      .select("broadcast_id, business_name, business_phone")
      .eq("id", reply.broadcast_target_id)
      .single();

    if (targetError || !target) {
      logStructuredEvent("VENDOR_RESPONSE_TARGET_NOT_FOUND", {
        replyId: reply.id,
        targetId: reply.broadcast_target_id,
        error: targetError?.message,
        correlationId,
      }, "error");
      return;
    }

    // Get broadcast request to find user phone
    const { data: broadcast, error: broadcastError } = await supabase
      .from("whatsapp_broadcast_requests")
      .select("user_phone, need_description")
      .eq("id", target.broadcast_id)
      .single();

    if (broadcastError || !broadcast || !broadcast.user_phone) {
      logStructuredEvent("VENDOR_RESPONSE_BROADCAST_NOT_FOUND", {
        replyId: reply.id,
        broadcastId: target.broadcast_id,
        error: broadcastError?.message,
        correlationId,
      }, "error");
      return;
    }

    // Check if we've already notified this user about this reply
    const { data: existingNotification } = await supabase
      .from("vendor_response_notifications")
      .select("id")
      .eq("broadcast_target_id", reply.broadcast_target_id)
      .eq("vendor_reply_id", reply.id)
      .eq("user_phone", broadcast.user_phone)
      .not("notified_at", "is", null)
      .maybeSingle();

    if (existingNotification) {
      // Already notified, skip
      logStructuredEvent("VENDOR_RESPONSE_ALREADY_NOTIFIED", {
        replyId: reply.id,
        userPhone: `***${broadcast.user_phone.slice(-4)}`,
        correlationId,
      });
      return;
    }

    // Create notification record
    const { data: notification, error: notificationError } = await supabase
      .from("vendor_response_notifications")
      .insert({
        broadcast_id: target.broadcast_id,
        broadcast_target_id: reply.broadcast_target_id,
        vendor_reply_id: reply.id,
        user_phone: broadcast.user_phone,
        business_name: target.business_name,
        business_phone: target.business_phone,
        vendor_response: reply.raw_body,
        response_action: reply.action,
      })
      .select()
      .single();

    if (notificationError) {
      logStructuredEvent("VENDOR_RESPONSE_NOTIFICATION_CREATE_ERROR", {
        replyId: reply.id,
        error: notificationError.message,
        correlationId,
      }, "error");
      return;
    }

    // Build notification message
    let message = "";
    if (reply.action === "HAVE_IT" || reply.has_stock === true) {
      message = `✅ *${target.business_name}* has what you're looking for!\n\n`;
      message += `Contact them: ${target.business_phone}\n\n`;
      if (reply.raw_body && reply.raw_body.trim() !== "HAVE IT") {
        message += `Message: ${reply.raw_body}`;
      }
    } else if (reply.action === "NO_STOCK" || reply.has_stock === false) {
      message = `❌ *${target.business_name}* doesn't have it in stock right now.\n\n`;
      if (reply.raw_body && reply.raw_body.trim() !== "NO STOCK") {
        message += `Note: ${reply.raw_body}`;
      }
    } else {
      // Generic response
      message = `📬 *${target.business_name}* responded:\n\n${reply.raw_body}\n\n`;
      message += `Contact: ${target.business_phone}`;
    }

    // Send notification to user
    const sendResult = await sendText(broadcast.user_phone, message);

    // Update notification record
    await supabase
      .from("vendor_response_notifications")
      .update({
        notified_at: new Date().toISOString(),
        message_sent: true,
        message_wa_id: sendResult?.message_id || null,
      })
      .eq("id", notification.id);

    logStructuredEvent("VENDOR_RESPONSE_USER_NOTIFIED", {
      replyId: reply.id,
      userPhone: `***${broadcast.user_phone.slice(-4)}`,
      businessName: target.business_name,
      action: reply.action,
      correlationId,
    });

  } catch (error) {
    logStructuredEvent("VENDOR_RESPONSE_NOTIFICATION_ERROR", {
      replyId: reply.id,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
  }
}

/**
 * Get all vendor responses for a broadcast and notify user
 * 
 * @param supabase - Supabase client
 * @param broadcastId - Broadcast request ID
 * @param correlationId - Correlation ID for logging
 */
export async function notifyUserOfAllVendorResponses(
  supabase: SupabaseClient,
  broadcastId: string,
  correlationId?: string
): Promise<void> {
  try {
    // Get all vendor replies for this broadcast
    const { data: targets } = await supabase
      .from("whatsapp_broadcast_targets")
      .select("id, business_phone")
      .eq("broadcast_id", broadcastId);

    if (!targets || targets.length === 0) {
      return;
    }

    const targetIds = targets.map(t => t.id);

    const { data: replies } = await supabase
      .from("whatsapp_business_replies")
      .select("*")
      .in("broadcast_target_id", targetIds)
      .order("created_at", { ascending: true });

    if (!replies || replies.length === 0) {
      return;
    }

    // Notify user of each reply
    for (const reply of replies) {
      await notifyUserOfVendorResponse(supabase, reply as VendorReply, correlationId);
    }

  } catch (error) {
    logStructuredEvent("VENDOR_RESPONSE_BATCH_NOTIFICATION_ERROR", {
      broadcastId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
  }
}

