// =====================================================
// SEND INSURANCE ADMIN NOTIFICATIONS
// =====================================================
// Processes queued insurance admin notifications
// and sends them via WhatsApp using wa-webhook client
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      .select("id, to_wa_id, payload")
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
      try {
        const message = notif.payload.text || notif.payload.message;
        
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
            updated_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        // Update insurance_admin_notifications
        await supabase
          .from("insurance_admin_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("admin_wa_id", notif.to_wa_id)
          .eq("status", "queued");

        sent++;
        console.log(`Sent notification to ${notif.to_wa_id}`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${notif.to_wa_id}: ${errorMsg}`);
        
        // Mark as failed
        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error_message: errorMsg,
            retry_count: (notif.payload.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", notif.id);
        
        console.error(`Failed to send to ${notif.to_wa_id}:`, error);
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
    console.error("Send insurance admin notifications error:", error);
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
