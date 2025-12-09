import { validateHmacRequest } from "../_shared/auth.ts";
import { serveWithObservability } from "../_shared/observability.ts";
import { createServiceClient } from "../_shared/mod.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

// Deno edge function for parsing MoMo SMS messages using deterministic regex with OpenAI Structured Outputs fallback

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const decoder = new TextDecoder();

const unauthorized = (reason: string, status = 401) =>
  new Response(JSON.stringify({ success: false, error: reason }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ... (rest of the file until serveWithObservability)

serveWithObservability("parse-sms", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const rateLimitAllowed = await enforceRateLimit(supabase, "sms-parse", {
      maxHits: 100,
      windowSeconds: 60,
    });

    if (!rateLimitAllowed) {
      return new Response("Rate limit exceeded", { status: 429 });
    }

    const validation = await validateHmacRequest(req);

    if (!validation.ok) {
      console.warn("parse-sms.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return unauthorized("invalid_signature", status);
    }

    const rawPayload = decoder.decode(validation.rawBody);
    const contentType = req.headers.get("content-type") ?? "application/json";
    let payload: SmsParseRequest;

    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(rawPayload) as SmsParseRequest;
      } catch (error) {
        console.warn("parse-sms.json_parse_failed", { error: String(error) });
        return unauthorized("invalid_payload", 400);
      }
    } else {
      payload = { rawText: rawPayload };
    }

    const { rawText, receivedAt, vendorMeta } = payload;

    if (!rawText || rawText.trim().length === 0) {
      return unauthorized("missing_body", 400);
    }

    console.log("Parsing SMS", { receivedAt, length: rawText?.length ?? 0 });

    let parsed = parseWithRegex(rawText, receivedAt);
    let parseSource: "REGEX" | "AI" = "REGEX";
    let modelUsed: string | null = null;

    if (!parsed || parsed.confidence < 0.9) {
      console.log("Regex failed or low confidence, invoking OpenAI fallback");
      const { transaction, model } = await parseWithOpenAI(rawText, receivedAt);
      parsed = transaction;
      parseSource = "AI";
      modelUsed = model;
    }

    console.log("Parse successful", {
      parseSource,
      confidence: parsed.confidence,
      model: modelUsed,
    });

    return new Response(
      JSON.stringify({
        success: true,
        parsed,
        parseSource,
        modelUsed,
        vendorMeta,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Parse error", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
