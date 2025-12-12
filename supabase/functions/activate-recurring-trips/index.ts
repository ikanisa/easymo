// Edge Function: Activate Recurring Trips
// Can be called manually for testing or by cron
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface ActivationResult {
  success: boolean;
  created_count: number;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Call the database function to activate recurring trips
    const { data, error } = await supabase.rpc("activate_recurring_trips");

    if (error) {
      console.error("Error activating recurring trips:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          message: "Failed to activate recurring trips"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: ActivationResult = {
      success: true,
      created_count: data ?? 0,
      message: `Successfully activated ${data ?? 0} recurring trips`,
    };

    console.log("Recurring trips activated:", result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: "Unexpected error activating recurring trips"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
