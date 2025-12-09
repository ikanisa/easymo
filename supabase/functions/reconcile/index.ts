import { Buffer } from "node:buffer";
import { createServiceClient, jsonResponse, verifyHmacSignature } from "../_shared/mod.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
const SIGNATURE_TOLERANCE_SECONDS = parseInt(
  Deno.env.get("TAPMOMO_SIGNATURE_TOLERANCE_SECONDS") ?? "300",
  10
);

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ReconcileRequest {
  transaction_id: string;
  merchant_id: string;
  amount?: number;
  currency?: string;
  status: "pending" | "settled" | "failed";
  payer_hint?: string;
  notes?: string;
  ref?: string;
  nonce?: string;
}

interface MerchantRecord {
  id: string;
  secret_key: unknown;
}

const buildMessage = (timestamp: string, context: string, body: Uint8Array) => {
  const timestampBytes = encoder.encode(timestamp);
  const contextBytes = encoder.encode(context);
  const message = new Uint8Array(timestampBytes.length + contextBytes.length + body.length);
  message.set(timestampBytes, 0);
  message.set(contextBytes, timestampBytes.length);
  message.set(body, timestampBytes.length + contextBytes.length);
  return message;
};

const decodeSecretKey = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("empty secret key");
    }
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
    const data = (value as { data: number[] }).data;
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
  }

  throw new Error("invalid merchant secret");
};

const sanitizeStatus = (status: string): "pending" | "settled" | "failed" => {
  if (status === "pending" || status === "settled" || status === "failed") {
    return status;
  }
  throw new Error("unsupported status");
};

const jsonWithCors = (data: unknown, init?: ResponseInit) =>
  jsonResponse(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });

serveWithObservability("reconcile", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonWithCors({ error: "method_not_allowed" }, { status: 405 });
  }

  let rawBody: Uint8Array;
  try {
    rawBody = new Uint8Array(await req.arrayBuffer());
  } catch (error) {
    console.error("reconcile.read_body_failed", error);
    return jsonWithCors({ error: "invalid_payload" }, { status: 400 });
  }

  let payload: ReconcileRequest;
  try {
    payload = JSON.parse(decoder.decode(rawBody)) as ReconcileRequest;
  } catch (error) {
    console.error("reconcile.json_parse_failed", error);
    return jsonWithCors({ error: "invalid_payload" }, { status: 400 });
  }

  if (!payload.transaction_id || !payload.merchant_id || !payload.status) {
    return jsonWithCors({ error: "missing_required_fields" }, { status: 400 });
  }

  const status = (() => {
    try {
      return sanitizeStatus(payload.status);
    } catch (error) {
      console.warn("reconcile.unsupported_status", { status: payload.status, error });
      return null;
    }
  })();

  if (!status) {
    return jsonWithCors({ error: "invalid_status" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, secret_key")
    .eq("id", payload.merchant_id)
    .single<MerchantRecord>();

  if (merchantError || !merchant) {
    console.warn("reconcile.merchant_not_found", {
      merchantId: payload.merchant_id,
      error: merchantError,
    });
    return jsonWithCors({ error: "merchant_not_found" }, { status: 404 });
  }

  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");

  if (!timestamp || !signature) {
    return jsonWithCors({ error: "missing_signature" }, { status: 401 });
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (Number.isNaN(parsedTimestamp)) {
    return jsonWithCors({ error: "invalid_timestamp" }, { status: 401 });
  }

  const ageMs = Math.abs(Date.now() - parsedTimestamp);
  if (ageMs > SIGNATURE_TOLERANCE_SECONDS * 1000) {
    return jsonWithCors({ error: "signature_expired" }, { status: 408 });
  }

  let secret: Uint8Array;
  try {
    secret = decodeSecretKey(merchant.secret_key);
  } catch (error) {
    console.error("reconcile.secret_decode_failed", error);
    return jsonWithCors({ error: "server_error" }, { status: 500 });
  }

  const context = `${req.method.toUpperCase()}:${new URL(req.url).pathname}`;
  const message = buildMessage(timestamp, context, rawBody);

  if (!verifyHmacSignature(secret, message, signature)) {
    console.warn("reconcile.signature_invalid", { merchantId: merchant.id });
    return jsonWithCors({ error: "invalid_signature" }, { status: 401 });
  }

  const upsertPayload: Record<string, unknown> = {
    id: payload.transaction_id,
    merchant_id: merchant.id,
    nonce: payload.nonce ?? payload.transaction_id,
    status,
  };

  if (typeof payload.amount === "number" && Number.isFinite(payload.amount)) {
    upsertPayload.amount = Math.trunc(payload.amount);
  }

  if (payload.currency) {
    upsertPayload.currency = payload.currency;
  }

  if (payload.ref) {
    upsertPayload.ref = payload.ref;
  }

  if (payload.payer_hint) {
    upsertPayload.payer_hint = payload.payer_hint;
  }

  if (payload.notes) {
    upsertPayload.notes = payload.notes;
  }

  const { data: transaction, error: upsertError } = await supabase
    .from("transactions")
    .upsert(upsertPayload, { onConflict: "id" })
    .select()
    .single();

  if (upsertError) {
    console.error("reconcile.upsert_failed", upsertError);
    return jsonWithCors({ error: "reconcile_failed" }, { status: 500 });
  }

  await recordMetric(supabase, "tapmomo_reconcile", 1, {
    merchantId: merchant.id,
    status,
  });

  return jsonWithCors({ success: true, transaction });
});
