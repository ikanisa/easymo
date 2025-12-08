/**
 * Insurance Admin Health Check
 * 
 * Verifies that insurance admin notification system is properly configured
 * by checking the insurance_admin_contacts table.
 * 
 * Returns structured health status for monitoring and debugging.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { logStructuredEvent } from "../_shared/observability.ts";

// Constants
const MIN_WHATSAPP_ID_LENGTH = 8;

interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  sources: {
    insurance_admin_contacts: {
      configured: boolean;
      count: number;
      activeWhatsAppCount: number;
      error?: string;
    };
  };
  summary: {
    totalAvailableAdmins: number;
    recommendations: string[];
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    logStructuredEvent("INSURANCE_ADMIN_HEALTH_CHECK_START", {}, "info");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SERVICE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const result: HealthCheckResult = {
      healthy: false,
      timestamp: new Date().toISOString(),
      sources: {
        insurance_admin_contacts: {
          configured: false,
          count: 0,
          activeWhatsAppCount: 0,
        },
      },
      summary: {
        totalAvailableAdmins: 0,
        recommendations: [],
      },
    };

    // Check insurance_admin_contacts table
    try {
      const { data: contacts, error } = await client
        .from("insurance_admin_contacts")
        .select("id, channel, destination, is_active")
        .eq("is_active", true);

      if (error) {
        result.sources.insurance_admin_contacts.error = error.message;
      } else {
        const whatsappContacts = (contacts ?? []).filter(
          (c) => c.channel === "whatsapp" && c.destination?.trim()
        );
        result.sources.insurance_admin_contacts.count = contacts?.length ?? 0;
        result.sources.insurance_admin_contacts.activeWhatsAppCount = whatsappContacts.length;
        result.sources.insurance_admin_contacts.configured = whatsappContacts.length > 0;
      }
    } catch (err) {
      result.sources.insurance_admin_contacts.error = 
        err instanceof Error ? err.message : String(err);
    }

    // Determine health
    if (result.sources.insurance_admin_contacts.activeWhatsAppCount > 0) {
      result.summary.totalAvailableAdmins = result.sources.insurance_admin_contacts.activeWhatsAppCount;
      result.healthy = true;
    } else {
      result.summary.totalAvailableAdmins = 0;
      result.healthy = false;
    }

    // Generate recommendations
    if (!result.healthy) {
      result.summary.recommendations.push(
        "CRITICAL: No insurance admin contacts configured. Add at least one admin contact to receive notifications."
      );
      result.summary.recommendations.push(
        "Add records to insurance_admin_contacts table with channel='whatsapp' and is_active=true"
      );
    } else if (result.summary.totalAvailableAdmins === 1) {
      result.summary.recommendations.push(
        "Only one admin configured. Consider adding more admins for redundancy."
      );
    }

    logStructuredEvent("INSURANCE_ADMIN_HEALTH_CHECK_COMPLETE", {
      healthy: result.healthy,
      totalAdmins: result.summary.totalAvailableAdmins,
    }, result.healthy ? "info" : "error");

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: result.healthy ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logStructuredEvent("INSURANCE_ADMIN_HEALTH_CHECK_ERROR", {
      error: errorMessage,
    }, "error");

    return new Response(
      JSON.stringify({
        healthy: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
