import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function handleHealthCheck(
  supabase: SupabaseClient
): Promise<Response> {
  try {
    // Test database connection
    const { error } = await supabase
      .from("job_listings")
      .select("id")
      .limit(1);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "wa-webhook-jobs",
        timestamp: new Date().toISOString(),
        database: "connected",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        service: "wa-webhook-jobs",
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
