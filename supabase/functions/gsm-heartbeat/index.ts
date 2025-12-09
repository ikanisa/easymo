import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateHmacRequest } from "../_shared/auth.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { requireEnv } from "../_shared/mod.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const HEARTBEAT_TIMEOUT_MS = Math.max(
  parseInt(Deno.env.get("GSM_HEARTBEAT_TIMEOUT_MS") ?? "8000", 10),
  1000
);

interface EndpointRow {
  id: string;
  gateway: string;
  display_name: string | null;
  health_url: string;
  auth_header: string | null;
  expected_keyword: string | null;
  status: string;
}

type HeartbeatStatus = "UP" | "DOWN" | "DEGRADED";

const classifyResponse = async (
  response: Response,
  expectedKeyword: string | null
): Promise<HeartbeatStatus> => {
  if (!response.ok) {
    return "DOWN";
  }
  if (!expectedKeyword) {
    return "UP";
  }
  const text = await response.text();
  if (text.toLowerCase().includes(expectedKeyword.toLowerCase())) {
    return "UP";
  }
  return "DEGRADED";
};

const checkEndpoint = async (endpoint: EndpointRow) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  const started = performance.now();
  try {
    const headers = new Headers();
    headers.set("accept", "text/plain,application/json");
    if (endpoint.auth_header) {
      headers.set("authorization", endpoint.auth_header);
    }

    const response = await fetch(endpoint.health_url, {
      headers,
      signal: controller.signal,
    });

    const status = await classifyResponse(response, endpoint.expected_keyword);
    const latencyMs = Math.round(performance.now() - started);

    return { status, latencyMs, error: null as string | null };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    return {
      status: "DOWN" as HeartbeatStatus,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

serveWithObservability("gsm-heartbeat", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateHmacRequest(req, { toleranceSeconds: 120 });

    if (!validation.ok) {
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "ibimina/gsm-heartbeat" } },
    });

    const { data: endpoints, error: endpointError } = await supabase
      .schema("app")
      .from("sms_gateway_endpoints")
      .select("id, gateway, display_name, health_url, auth_header, expected_keyword, status")
      .eq("status", "ACTIVE");

    if (endpointError) {
      throw endpointError;
    }

    if (!endpoints?.length) {
      return new Response(JSON.stringify({ success: true, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summaries: Array<{
      id: string;
      status: HeartbeatStatus;
      latencyMs: number;
      error: string | null;
    }> = [];

    for (const endpoint of endpoints as EndpointRow[]) {
      const outcome = await checkEndpoint(endpoint);
      summaries.push({
        id: endpoint.id,
        status: outcome.status,
        latencyMs: outcome.latencyMs,
        error: outcome.error,
      });

      await supabase.schema("app").from("sms_gateway_heartbeats").insert({
        endpoint_id: endpoint.id,
        status: outcome.status,
        latency_ms: outcome.latencyMs,
        error: outcome.error,
      });

      await supabase
        .schema("app")
        .from("sms_gateway_endpoints")
        .update({
          last_status: outcome.status,
          last_heartbeat_at: new Date().toISOString(),
          last_latency_ms: outcome.latencyMs,
          last_error: outcome.error,
        })
        .eq("id", endpoint.id);

      if (outcome.status === "UP") {
        await recordMetric(supabase, "gsm_heartbeat_up", 1, { gateway: endpoint.gateway });
      } else {
        await recordMetric(supabase, "gsm_heartbeat_failure", 1, {
          gateway: endpoint.gateway,
          status: outcome.status,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: summaries.length, results: summaries }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("gsm-heartbeat failure", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
