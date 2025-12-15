/**
 * wa-webhook-insurance
 * 
 * Simple insurance workflow edge function:
 * User taps "Insurance" → Receives WhatsApp links to insurance agents → Contacts agents directly
 * 
 * NO admin panels, NO leads tracking, NO OCR, NO notifications
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsuranceContact {
  display_name: string;
  destination: string;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await logStructuredEvent("INSURANCE_REQUEST_START", {
      requestId,
      method: req.method,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      await logStructuredEvent("INSURANCE_CONFIG_ERROR", {
        requestId,
        error: "Missing Supabase configuration",
      }, "error");
      
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active insurance contacts from insurance_admin_contacts table
    const { data: contacts, error } = await supabase
      .from("insurance_admin_contacts")
      .select("display_name, destination")
      .eq("channel", "whatsapp")
      .eq("category", "insurance")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      await logStructuredEvent("INSURANCE_DB_ERROR", {
        requestId,
        error: error.message,
      }, "error");

      return new Response(
        JSON.stringify({ error: "Failed to fetch insurance contacts" }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if contacts are available
    if (!contacts || contacts.length === 0) {
      await logStructuredEvent("INSURANCE_NO_CONTACTS", {
        requestId,
      }, "warn");

      return new Response(
        JSON.stringify({ 
          error: "No insurance contacts available",
          message: "Please try again later or contact support."
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Build WhatsApp links message
    const contactLinks = contacts
      .map((c: InsuranceContact) => {
        // Remove + prefix from phone number for wa.me link
        const cleanNumber = c.destination.replace(/^\+/, "");
        return `• ${c.display_name}: https://wa.me/${cleanNumber}`;
      })
      .join("\n");

    const message = `🛡️ *Insurance Services*

Contact our insurance agents directly on WhatsApp:

${contactLinks}

Tap any link above to start chatting with an insurance agent.`;

    await logStructuredEvent("INSURANCE_SUCCESS", {
      requestId,
      contactCount: contacts.length,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        contactCount: contacts.length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    await logStructuredEvent("INSURANCE_ERROR", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    }, "error");

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
