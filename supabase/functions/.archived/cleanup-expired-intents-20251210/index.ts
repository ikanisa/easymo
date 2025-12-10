// Edge Function: Cleanup Expired Mobility Intents
// Can be called manually or by cron
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface CleanupResult {
  success: boolean;
  deleted_count: number;
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

    // Call the database function to cleanup expired intents
    const { data, error } = await supabase.rpc("cleanup_expired_mobility_intents");

    if (error) {
      console.error("Error cleaning up expired intents:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          message: "Failed to cleanup expired intents"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: CleanupResult = {
      success: true,
      deleted_count: data ?? 0,
      message: `Successfully cleaned up ${data ?? 0} expired intents`,
    };

    console.log("Expired intents cleaned up:", result);

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
        message: "Unexpected error cleaning up intents"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
