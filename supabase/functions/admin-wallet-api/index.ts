import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from Wallet Admin API!");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check if user is admin (using service role check or specific table)
    // For now, assuming authenticated users with access to this API are admins
    // In production, check a 'roles' table or similar

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "GET") {
      if (path === "stats") {
        const { data, error } = await supabaseClient.rpc("get_wallet_statistics");
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (path === "fraud-alerts") {
        const { data, error } = await supabaseClient
          .from("wallet_fraud_alerts")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (path === "reconciliation") {
        const { data, error } = await supabaseClient
          .from("wallet_reconciliation_reports")
          .select("*")
          .order("report_date", { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== "PGRST116") throw error; // Ignore not found
        return new Response(JSON.stringify(data || { status: "no_reports" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "POST") {
      if (path === "run-reconciliation") {
        const { data, error } = await supabaseClient.rpc("run_daily_reconciliation");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, report_id: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
