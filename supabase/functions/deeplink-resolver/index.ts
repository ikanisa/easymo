import { serve } from "../wa-webhook/deps.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";
import {
  DeeplinkResolveSchema,
  validateBody,
  validationErrorResponse,
  isRateLimited,
  rateLimitErrorResponse,
  getClientIP,
} from "../_shared/validation.ts";

const DEFAULT_ALLOWED_ORIGINS = (Deno.env.get("DEEPLINK_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = DEFAULT_ALLOWED_ORIGINS.length
    ? DEFAULT_ALLOWED_ORIGINS
    : ["*"];
  const headerOrigin = allowed.includes("*")
    ? "*"
    : (origin && allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": headerOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return null;
  const match = cleaned.match(/(?:JB[:\-])?([A-Z0-9]{4,})/);
  return match ? match[1] : null;
}

const REMOVAL_RESPONSE = {
  ok: false,
  error: "feature_removed",
  message:
    "Legacy invite deeplinks are discontinued. Direct riders to the standard WhatsApp menu.",
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);
  const correlationId = crypto.randomUUID();

  await logStructuredEvent("DEEPLINK_REQUEST", {
    correlationId,
    method: req.method,
    origin: origin || "unknown",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const rateLimitKey = `deeplink:${clientIP}`;
  const rateLimitResult = isRateLimited(rateLimitKey, {
    windowMs: 60 * 1000,
    maxRequests: 10,
  });

  if (rateLimitResult.limited) {
    await logStructuredEvent("DEEPLINK_RATE_LIMITED", {
      correlationId,
      clientIP,
      resetAt: rateLimitResult.resetAt,
    });
    return rateLimitErrorResponse(rateLimitResult.resetAt);
  }

  let rawToken: unknown;

  if (req.method === "GET") {
    const url = new URL(req.url);
    rawToken = url.searchParams.get("token");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      const validation = validateBody(DeeplinkResolveSchema, body);
      if (!validation.success) {
        await logStructuredEvent("DEEPLINK_VALIDATION_FAILED", {
          correlationId,
          errors: validation.error.errors,
        });
        return validationErrorResponse(validation.error);
      }
      rawToken = validation.data.token;
    } catch (_error) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_json" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }
  } else {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  const token = normalizeToken(rawToken);
  if (!token) {
    const body = JSON.stringify({ ok: false, error: "token_required" });
    return new Response(body, {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  await logStructuredEvent("DEEPLINK_FEATURE_REMOVED", {
    correlationId,
    clientIP,
    token,
  });

  return new Response(JSON.stringify(REMOVAL_RESPONSE), {
    status: 410,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
