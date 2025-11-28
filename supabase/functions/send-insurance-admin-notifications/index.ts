// =====================================================
// SEND INSURANCE ADMIN NOTIFICATIONS
// =====================================================
// Processes queued insurance admin notifications
// and sends them via WhatsApp using wa-webhook client
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../wa-webhook/wa/client.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json().catch(() => ({}));

    // Get queued insurance admin notifications
    const { data: notifications, error: fetchError } = await supabase
      .from("notifications")
      .select("id, to_wa_id, payload, retry_count")
      .eq("notification_type", "insurance_admin_alert")
      .eq("status", "queued")
      .order("created_at")
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No pending notifications",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send each notification
    for (const notif of notifications) {
      const payload = notif.payload as Record<string, any> | null;
      const adminNotificationId = payload?.admin_notification_id as string | undefined;
      const message = payload?.text || payload?.message;
      const currentRetries = typeof notif.retry_count === "number"
        ? notif.retry_count
        : 0;

      try {
        if (!message) {
          throw new Error("No message text found in payload");
        }

        // Send via wa-webhook client
        await sendText(notif.to_wa_id, message);

        // Mark as sent
        await supabase
          .from("notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            retry_count: currentRetries,
            updated_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        if (adminNotificationId) {
          await supabase
            .from("insurance_admin_notifications")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              retry_count: currentRetries,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", adminNotificationId);
        }

        sent++;
        await logStructuredEvent("LOG", { data: `Sent notification to ${notif.to_wa_id}` });
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${notif.to_wa_id}: ${errorMsg}`);

        const nextRetry = currentRetries + 1;
        const failureTime = new Date().toISOString();

        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error_message: errorMsg,
            retry_count: nextRetry,
            updated_at: failureTime,
          })
          .eq("id", notif.id);

        if (adminNotificationId) {
          await supabase
            .from("insurance_admin_notifications")
            .update({
              status: "failed",
              error_message: errorMsg,
              retry_count: nextRetry,
              updated_at: failureTime,
            })
            .eq("id", adminNotificationId);
        }

        await logStructuredEvent("ERROR", { data: `Failed to send to ${notif.to_wa_id}:`, error });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: notifications.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    await logStructuredEvent("ERROR", { data: "Send insurance admin notifications error:", error });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
