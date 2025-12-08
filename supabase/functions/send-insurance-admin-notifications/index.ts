// =====================================================
// SEND INSURANCE ADMIN NOTIFICATIONS
// =====================================================
// Processes queued insurance admin notifications
// NOTE: This function is deprecated in favor of direct sending
// from ins_admin_notify.ts. Keeping for backward compatibility.
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
    await logStructuredEvent("INSURANCE_ADMIN_NOTIFICATION_DEPRECATED", { 
      event: "This function is deprecated. Notifications are now sent directly from ins_admin_notify.ts", 
      method: req.method 
    }, "warn");

    return new Response(
      JSON.stringify({
        success: true,
        message: "This function is deprecated. Notifications are sent directly from ins_admin_notify.ts",
        sent: 0,
        failed: 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    await logStructuredEvent("FUNCTION_ERROR", { 
      event: "FUNCTION_ERROR", 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    }, "error");
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
