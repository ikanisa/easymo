import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_URL = Deno.env.get("SERVICE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("WA_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HMAC_SECRET = Deno.env.get("MOMO_SMS_HMAC_SECRET") ?? "";
const ALLOWED_IPS = (Deno.env.get("MOMO_SMS_ALLOWED_IPS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const DEFAULT_SOURCE = Deno.env.get("MOMO_SMS_DEFAULT_SOURCE") ?? "gateway";

const SB_URL = SUPABASE_URL || SERVICE_URL;
const SB_KEY = SUPABASE_SERVICE_ROLE_KEY || SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  throw new Error(
    "Supabase service credentials must be configured for momo-sms-hook",
  );
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, authorization, x-signature, x-api-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type SmsPayload = {
  message: string;
  msisdn?: string | null;
  receivedAt?: string | null;
  ingestSource?: string | null;
  metadata?: Record<string, unknown> | null;
};

type JsonValue = string | number | boolean | null | JsonValue[] | {
  [key: string]: JsonValue;
};

function jsonResponse(
  body: JsonValue | Record<string, JsonValue>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() ?? null;
}

function isIpAllowed(request: Request): boolean {
  if (!ALLOWED_IPS.length) return true;
  const clientIp = extractClientIp(request);
  if (!clientIp) return false;
  return ALLOWED_IPS.includes(clientIp);
}

async function computeHmacHex(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bufferToHex(signature);
}

async function verifySignature(
  body: string,
  headerSignature: string | null,
): Promise<boolean> {
  if (!HMAC_SECRET) return true;
  if (!headerSignature) return false;
  const expected = await computeHmacHex(HMAC_SECRET, body);
  return timingSafeEquals(expected, headerSignature.trim());
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (const byte of bytes) {
    hex.push(byte.toString(16).padStart(2, "0"));
  }
  return hex.join("");
}

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bufferToHex(digest);
}

function parsePayload(text: string): SmsPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    throw new Error("invalid_json");
  }
  const payload = parsed as Record<string, unknown>;
  const message = typeof payload.message === "string"
    ? payload.message.trim()
    : "";
  if (!message) throw new Error("message_required");
  const msisdn = typeof payload.msisdn === "string"
    ? payload.msisdn.trim()
    : null;
  const receivedAt = typeof payload.receivedAt === "string"
    ? payload.receivedAt.trim()
    : null;
  const ingestSource = typeof payload.ingestSource === "string"
    ? payload.ingestSource.trim()
    : null;
  const metadata =
    typeof payload.metadata === "object" && payload.metadata !== null
      ? payload.metadata as Record<string, unknown>
      : null;
  return { message, msisdn, receivedAt, ingestSource, metadata };
}

function normaliseReceivedAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return new Date().toISOString();
  }
  return timestamp.toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!isIpAllowed(request)) {
    return jsonResponse({ ok: false, error: "ip_forbidden" }, 403);
  }

  const rawBody = await request.text();

  const headerSignature = request.headers.get("x-signature") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-api-key");

  const signatureValid = await verifySignature(rawBody, headerSignature);
  if (!signatureValid) {
    return jsonResponse({ ok: false, error: "invalid_signature" }, 401);
  }

  let payload: SmsPayload;
  try {
    payload = parsePayload(rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_payload";
    return jsonResponse({ ok: false, error: message }, 400);
  }

  const receivedAt = normaliseReceivedAt(payload.receivedAt ?? null);
  const hashInput = `${payload.message}|${payload.msisdn ?? ""}|${receivedAt}`;
  const hash = await sha256Hex(hashInput);

  const { data, error } = await supabase
    .from("momo_sms_inbox")
    .insert({
      raw_text: payload.message,
      msisdn_raw: payload.msisdn ?? null,
      received_at: receivedAt,
      ingest_source: payload.ingestSource ?? DEFAULT_SOURCE,
      hash,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ ok: true, duplicate: true });
    }
    console.error("momo_sms_hook.insert_failed", error);
    return jsonResponse({ ok: false, error: "inbox_insert_failed" }, 500);
  }

  console.log("momo_sms_hook.inserted", {
    inboxId: data.id,
    source: payload.ingestSource ?? DEFAULT_SOURCE,
  });
  return jsonResponse({ ok: true, duplicate: false, inboxId: data.id });
});
