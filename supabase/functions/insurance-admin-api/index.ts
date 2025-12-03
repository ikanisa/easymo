/**
 * Insurance Admin API
 * 
 * Edge Function for admin operations on insurance certificates
 * 
 * Endpoints:
 * - GET /pending - List pending certificates
 * - POST /review - Approve/reject certificate
 * - POST /bulk-approve - Bulk approve certificates
 * - GET /stats - Get review statistics
 * - POST /send-reminders - Send expiry reminders
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getPendingCertificates,
  reviewInsuranceCertificate,
  bulkApproveCertificates,
  getReviewStatistics,
  getCertificateDetails,
} from "../wa-webhook-mobility/handlers/insurance_admin.ts";
import {
  sendExpiryReminders,
  markExpiredCertificates,
  notifyExpiredInsurance,
} from "../wa-webhook-mobility/handlers/insurance_notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user is admin (check JWT)
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse URL
    const url = new URL(req.url);
    const path = url.pathname;

    // Route requests
    if (path.endsWith("/pending") && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const certificates = await getPendingCertificates(supabase, limit);
      return new Response(JSON.stringify({ certificates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/certificate") && req.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing certificate ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const details = await getCertificateDetails(supabase, id);
      return new Response(JSON.stringify(details), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/review") && req.method === "POST") {
      const body = await req.json();
      const { certificateId, approved, notes } = body;

      if (!certificateId || approved === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await reviewInsuranceCertificate(
        supabase,
        certificateId,
        user.id,
        approved,
        notes,
      );

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/bulk-approve") && req.method === "POST") {
      const body = await req.json();
      const { certificateIds } = body;

      if (!Array.isArray(certificateIds)) {
        return new Response(
          JSON.stringify({ error: "certificateIds must be an array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await bulkApproveCertificates(
        supabase,
        certificateIds,
        user.id,
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/stats") && req.method === "GET") {
      const stats = await getReviewStatistics(supabase);
      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/send-reminders") && req.method === "POST") {
      const body = await req.json();
      const { daysBeforeExpiry = 7 } = body;

      const result = await sendExpiryReminders(supabase, daysBeforeExpiry);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/mark-expired") && req.method === "POST") {
      const result = await markExpiredCertificates(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.endsWith("/notify-expired") && req.method === "POST") {
      const result = await notifyExpiredInsurance(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("INSURANCE_ADMIN_API_ERROR", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
