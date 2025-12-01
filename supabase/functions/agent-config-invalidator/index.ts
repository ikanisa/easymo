/**
 * Agent Config Cache Invalidator
 * 
 * Edge Function that invalidates agent config caches when database changes occur
 * Triggered by database triggers on config table changes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface InvalidationRequest {
  agent_slug: string;
  table: string;
  operation: string;
  timestamp: string;
}

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify request is from Supabase (check secret header)
    const authHeader = req.headers.get("authorization");
    const expectedSecret = Deno.env.get("INVALIDATION_WEBHOOK_SECRET");
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      console.warn("Unauthorized cache invalidation attempt");
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse request body
    const payload: InvalidationRequest = await req.json();
    const { agent_slug, table, operation, timestamp } = payload;

    console.log(JSON.stringify({
      event: "CACHE_INVALIDATION_TRIGGERED",
      agent_slug,
      table,
      operation,
      timestamp
    }));

    // Initialize Redis
    const redisUrl = Deno.env.get("REDIS_URL");
    if (!redisUrl) {
      console.warn("REDIS_URL not configured, cache invalidation skipped");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Redis not configured" 
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const redis = new Redis({ url: redisUrl });

    // Invalidate Redis cache
    const redisKey = `agent:config:${agent_slug}`;
    const deleted = await redis.del(redisKey);

    console.log(JSON.stringify({
      event: "REDIS_CACHE_INVALIDATED",
      agent_slug,
      key: redisKey,
      deleted: deleted > 0,
      table,
      operation
    }));

    // Also log to Supabase for monitoring
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from("agent_config_cache_metrics")
        .insert({
          agent_slug,
          cache_hit: false,
          load_source: "invalidation",
          load_time_ms: 0
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_slug,
        table,
        operation,
        redis_deleted: deleted > 0,
        message: "Cache invalidated successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Cache invalidation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
