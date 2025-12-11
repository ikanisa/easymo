/**
 * Wallet Notifications Processor
 * Processes queued wallet transaction notifications and sends WhatsApp messages
 * Triggered by: Cron job (every minute) or manual invocation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

interface NotificationQueueItem {
  id: string;
  profile_id: string;
  transaction_id: string;
  amount: number;
  direction: string;
  description: string;
  new_balance: number;
  created_at: string;
}

interface ProfileInfo {
  whatsapp_e164: string;
  display_name: string;
}

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  
  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ 
      status: "healthy", 
      service: "wallet-notifications",
      timestamp: new Date().toISOString() 
    }), {
      headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Fetch pending notifications (limit to 50 per run)
    const { data: notifications, error: fetchError } = await supabase
      .from("wallet_notification_queue")
      .select("*")
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      logStructuredEvent("WALLET_NOTIFICATIONS_FETCH_ERROR", {
        error: fetchError.message,
        requestId,
      }, "error");
      
      return new Response(JSON.stringify({ 
        error: "fetch_failed", 
        message: fetchError.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: "No pending notifications" 
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    logStructuredEvent("WALLET_NOTIFICATIONS_PROCESSING", {
      count: notifications.length,
      requestId,
    }, "info");

    // Process each notification
    let sent = 0;
    let failed = 0;

    for (const notification of notifications as NotificationQueueItem[]) {
      try {
        // Fetch profile WhatsApp number
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("whatsapp_e164, display_name")
          .eq("user_id", notification.profile_id)
          .single();

        if (profileError || !profile || !profile.whatsapp_e164) {
          logStructuredEvent("WALLET_NOTIFICATION_NO_WHATSAPP", {
            notificationId: notification.id,
            profileId: notification.profile_id,
          }, "warn");
          
          // Mark as sent to avoid retry loop
          await supabase
            .from("wallet_notification_queue")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", notification.id);
          
          failed++;
          continue;
        }

        // Build notification message
        const message = buildNotificationMessage(
          notification,
          profile as ProfileInfo
        );

        // Send WhatsApp message
        await sendText(profile.whatsapp_e164, message);

        // Mark as sent
        await supabase
          .from("wallet_notification_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", notification.id);

        logStructuredEvent("WALLET_NOTIFICATION_SENT", {
          notificationId: notification.id,
          profileId: notification.profile_id,
          amount: notification.amount,
          direction: notification.direction,
        }, "info");

        sent++;
      } catch (error) {
        logStructuredEvent("WALLET_NOTIFICATION_SEND_ERROR", {
          notificationId: notification.id,
          error: error instanceof Error ? error.message : String(error),
        }, "error");
        
        failed++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: notifications.length,
      sent,
      failed,
      message: `Processed ${notifications.length} notifications: ${sent} sent, ${failed} failed`
    }), {
      headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
    });
  } catch (error) {
    logStructuredEvent("WALLET_NOTIFICATIONS_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    }, "error");

    return new Response(JSON.stringify({ 
      error: "processing_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function buildNotificationMessage(
  notification: NotificationQueueItem,
  profile: ProfileInfo
): string {
  const sign = notification.direction === "credit" ? "+" : "-";
  const emoji = notification.direction === "credit" ? "💎" : "💸";
  
  const lines = [
    `${emoji} *Wallet ${notification.direction === "credit" ? "Credit" : "Debit"}*`,
    "",
    `${sign}${notification.amount} tokens`,
  ];

  if (notification.description) {
    lines.push(`📝 ${notification.description}`);
  }

  lines.push("");
  lines.push(`💰 New Balance: ${notification.new_balance} tokens`);
  lines.push("");
  lines.push("Use */wallet* to view your full transaction history.");

  return lines.join("\n");
}
