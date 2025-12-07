/**
 * Insurance Admin Health Check
 * 
 * Verifies that insurance admin notification system is properly configured
 * by checking all three admin contact sources:
 * 1. insurance_admin_contacts table (WhatsApp type, active)
 * 2. insurance_admins table (active)
 * 3. INSURANCE_ADMIN_FALLBACK_WA_IDS environment variable
 * 
 * Returns structured health status for monitoring and debugging.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { logStructuredEvent } from "../_shared/observability.ts";

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
    insurance_admins: {
      configured: boolean;
      count: number;
      error?: string;
    };
    env_fallback: {
      configured: boolean;
      count: number;
      value?: string;
    };
  };
  summary: {
    totalAvailableAdmins: number;
    resolutionSource: string;
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
        insurance_admins: {
          configured: false,
          count: 0,
        },
        env_fallback: {
          configured: false,
          count: 0,
        },
      },
      summary: {
        totalAvailableAdmins: 0,
        resolutionSource: "none",
        recommendations: [],
      },
    };

    // Check insurance_admin_contacts table
    try {
      const { data: contacts, error } = await client
        .from("insurance_admin_contacts")
        .select("id, contact_type, contact_value, is_active")
        .eq("is_active", true);

      if (error) {
        result.sources.insurance_admin_contacts.error = error.message;
      } else {
        const whatsappContacts = (contacts ?? []).filter(
          (c) => c.contact_type === "whatsapp" && c.contact_value?.trim()
        );
        result.sources.insurance_admin_contacts.count = contacts?.length ?? 0;
        result.sources.insurance_admin_contacts.activeWhatsAppCount = whatsappContacts.length;
        result.sources.insurance_admin_contacts.configured = whatsappContacts.length > 0;
      }
    } catch (err) {
      result.sources.insurance_admin_contacts.error = 
        err instanceof Error ? err.message : String(err);
    }

    // Check insurance_admins table
    try {
      const { data: admins, error } = await client
        .from("insurance_admins")
        .select("id, wa_id, is_active")
        .eq("is_active", true);

      if (error) {
        result.sources.insurance_admins.error = error.message;
      } else {
        const validAdmins = (admins ?? []).filter(
          (a) => a.wa_id && String(a.wa_id).trim().length >= 8
        );
        result.sources.insurance_admins.count = validAdmins.length;
        result.sources.insurance_admins.configured = validAdmins.length > 0;
      }
    } catch (err) {
      result.sources.insurance_admins.error = 
        err instanceof Error ? err.message : String(err);
    }

    // Check INSURANCE_ADMIN_FALLBACK_WA_IDS env var
    const fallbackIds = Deno.env.get("INSURANCE_ADMIN_FALLBACK_WA_IDS") ?? "";
    if (fallbackIds.trim()) {
      const ids = fallbackIds.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length >= 8);
      result.sources.env_fallback.configured = ids.length > 0;
      result.sources.env_fallback.count = ids.length;
      // Don't expose the actual IDs, just indicate they're set
      result.sources.env_fallback.value = ids.length > 0 ? `${ids.length} ID(s) configured` : undefined;
    }

    // Determine resolution source and health
    if (result.sources.insurance_admin_contacts.activeWhatsAppCount > 0) {
      result.summary.resolutionSource = "insurance_admin_contacts";
      result.summary.totalAvailableAdmins = result.sources.insurance_admin_contacts.activeWhatsAppCount;
      result.healthy = true;
    } else if (result.sources.insurance_admins.count > 0) {
      result.summary.resolutionSource = "insurance_admins";
      result.summary.totalAvailableAdmins = result.sources.insurance_admins.count;
      result.healthy = true;
    } else if (result.sources.env_fallback.configured) {
      result.summary.resolutionSource = "INSURANCE_ADMIN_FALLBACK_WA_IDS";
      result.summary.totalAvailableAdmins = result.sources.env_fallback.count;
      result.healthy = true;
    } else {
      result.summary.resolutionSource = "none";
      result.summary.totalAvailableAdmins = 0;
      result.healthy = false;
    }

    // Generate recommendations
    if (!result.healthy) {
      result.summary.recommendations.push(
        "CRITICAL: No insurance admin contacts configured. Add at least one admin contact to receive notifications."
      );
      result.summary.recommendations.push(
        "Option 1: Insert records into insurance_admin_contacts table with contact_type='whatsapp' and is_active=true"
      );
      result.summary.recommendations.push(
        "Option 2: Insert records into insurance_admins table with wa_id and is_active=true"
      );
      result.summary.recommendations.push(
        "Option 3: Set INSURANCE_ADMIN_FALLBACK_WA_IDS environment variable with comma-separated WhatsApp IDs"
      );
    } else if (result.summary.resolutionSource === "INSURANCE_ADMIN_FALLBACK_WA_IDS") {
      result.summary.recommendations.push(
        "Currently using fallback environment variable. Consider migrating to insurance_admin_contacts table for better management."
      );
    } else if (result.summary.totalAvailableAdmins === 1) {
      result.summary.recommendations.push(
        "Only one admin configured. Consider adding more admins for redundancy."
      );
    }

    logStructuredEvent("INSURANCE_ADMIN_HEALTH_CHECK_COMPLETE", {
      healthy: result.healthy,
      resolutionSource: result.summary.resolutionSource,
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
