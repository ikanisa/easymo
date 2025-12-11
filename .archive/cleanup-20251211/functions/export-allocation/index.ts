import { createServiceClient, errorResponse, jsonResponse, parseJwt } from "../_shared/mod.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

serveWithObservability("export-allocation", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const auth = parseJwt(req.headers.get("authorization"));
    if (!auth.userId) {
      return errorResponse("Unauthorized", 401);
    }

    let body: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = ((await req.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await req.text());
      body = Object.fromEntries(params.entries());
    }

    const saccoId = readString(body.saccoId ?? body.sacco_id);
    const referenceToken = readString(body.referenceToken ?? body.reference_token);
    const period = readString(body.period ?? body.period_label);

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .schema("app")
      .from("allocation_export_requests")
      .insert({
        sacco_id: saccoId ?? null,
        reference_token: referenceToken ?? null,
        period_label: period ?? null,
        requested_by: auth.userId,
        payload: {
          saccoId: saccoId ?? null,
          referenceToken: referenceToken ?? null,
          period: period ?? null,
        },
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    return jsonResponse(
      {
        requestId: data?.id,
        status: data?.status,
        createdAt: data?.created_at,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("export-allocation error", error);
    return errorResponse("Unhandled error", 500);
  }
});
