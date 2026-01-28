// Auth QR - Unified QR code authentication handler
// Consolidates: auth-qr-generate, auth-qr-poll, auth-qr-verify

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "generate" | "poll" | "verify";

async function generateQR() {
  const qrId = crypto.randomUUID();
  const secret = encode(crypto.getRandomValues(new Uint8Array(32)));
  
  const { error } = await supabase
    .from("qr_auth_sessions")
    .insert({
      qr_id: qrId,
      secret,
      status: "pending",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    });

  if (error) throw error;

  return {
    qr_id: qrId,
    qr_data: JSON.stringify({ qrId, secret }),
    expires_in: 300,
  };
}

async function pollQR(qrId: string) {
  const { data, error } = await supabase
    .from("qr_auth_sessions")
    .select("status,user_id,phone_e164")
    .eq("qr_id", qrId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  
  if (!data) {
    return { status: "expired" };
  }

  return {
    status: data.status,
    user_id: data.user_id,
    phone_e164: data.phone_e164,
  };
}

async function verifyQR(qrId: string, secret: string, phoneE164: string) {
  const { data, error } = await supabase
    .from("qr_auth_sessions")
    .select("secret,status")
    .eq("qr_id", qrId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  
  if (!data || data.secret !== secret) {
    return { success: false, error: "invalid_qr" };
  }

  if (data.status !== "pending") {
    return { success: false, error: "already_used" };
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    return { success: false, error: "user_not_found" };
  }

  // Update session
  const { error: updateError } = await supabase
    .from("qr_auth_sessions")
    .update({
      status: "verified",
      user_id: profile.id,
      phone_e164: phoneE164,
      verified_at: new Date().toISOString(),
    })
    .eq("qr_id", qrId);

  if (updateError) throw updateError;

  return {
    success: true,
    user_id: profile.id,
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      action?: Action;
      qr_id?: string;
      secret?: string;
      phone_e164?: string;
    };
    
    const { action, qr_id, secret, phone_e164 } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action required", available: ["generate", "poll", "verify"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    
    switch (action) {
      case "generate":
        result = await generateQR();
        break;
      
      case "poll":
        if (!qr_id) {
          return new Response(
            JSON.stringify({ error: "qr_id required for poll" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await pollQR(qr_id);
        break;
      
      case "verify":
        if (!qr_id || !secret || !phone_e164) {
          return new Response(
            JSON.stringify({ error: "qr_id, secret, and phone_e164 required for verify" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await verifyQR(qr_id, secret, phone_e164);
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: "invalid_action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auth QR error:", error);
    return new Response(
      JSON.stringify({ error: "auth_qr_failed", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
