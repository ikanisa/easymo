import { z } from "zod";
import { serveWithObservability } from "../_shared/observability.ts";
import {
  createServiceClient,
  errorResponse,
  getForwardedIp,
  jsonResponse,
} from "../_shared/mod.ts";
import { validateHmacRequest } from "../_shared/auth.ts";
import { enforceIpRateLimit } from "../_shared/rate-limit.ts";
import { parseWithRegex } from "../_shared/sms-parser.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { resolveReference } from "../_shared/payments.ts";

const jsonPayloadSchema = z.object({
  text: z.string().min(5),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  saccoId: z.string().uuid().optional(),
  vendorMeta: z.record(z.any()).optional(),
});

const inferReceivedAt = (provided?: string) => {
  if (!provided) {
    return new Date().toISOString();
  }
  const parsed = new Date(provided);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-signature, x-timestamp",
  "access-control-allow-methods": "POST,OPTIONS",
};

const withCors = (response: Response) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
};

serveWithObservability("sms-inbox", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return withCors(errorResponse("Method not allowed", 405));
  }

  try {
    const validation = await validateHmacRequest(req);

    if (!validation.ok) {
      console.warn("sms-inbox.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return withCors(errorResponse("Invalid signature", status));
    }

    const rawBody = validation.rawBody;

    const supabase = createServiceClient();
    const clientIp = getForwardedIp(req.headers);
    const allowed = await enforceIpRateLimit(supabase, clientIp, "/sms/inbox", {
      maxHits: 60,
      windowSeconds: 60,
    });

    if (!allowed) {
      return withCors(errorResponse("Rate limit exceeded", 429));
    }

    const contentType = req.headers.get("content-type") ?? "text/plain";
    let rawText: string;
    let saccoId: string | null = null;
    let receivedAt: string | undefined;
    let vendorMeta: Record<string, unknown> | undefined;

    if (contentType.includes("application/json")) {
      const payload = jsonPayloadSchema.parse(JSON.parse(new TextDecoder().decode(rawBody)));
      rawText = payload.text;
      saccoId = payload.saccoId ?? null;
      receivedAt = payload.receivedAt;
      vendorMeta = payload.vendorMeta;
    } else {
      rawText = new TextDecoder().decode(rawBody);
    }

    const storedReceivedAt = inferReceivedAt(receivedAt);

    const { data: smsRecord, error: insertError } = await supabase
      .schema("app")
      .from("sms_inbox")
      .insert({
        sacco_id: saccoId,
        raw_text: rawText,
        received_at: storedReceivedAt,
        vendor_meta: vendorMeta ?? null,
        status: "NEW",
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const smsId = smsRecord.id as string;
    let responseStatus = "NEW";
    let paymentId: string | null = null;
    let resolvedSaccoId: string | null = saccoId;

    const parsed = parseWithRegex(rawText, storedReceivedAt);

    if (parsed && parsed.confidence >= 0.9) {
      const msisdnEncrypted = await encryptField(parsed.msisdn);
      const msisdnHash = await hashField(parsed.msisdn);
      const msisdnMasked = maskMsisdn(parsed.msisdn) ?? parsed.msisdn;

      const resolution = await resolveReference(supabase, parsed.reference, saccoId);
      resolvedSaccoId = resolution.saccoId;

      const paymentInsert = await supabase
        .schema("app")
        .from("payments")
        .insert({
          channel: "SMS",
          sacco_id: resolution.saccoId ?? saccoId,
          ikimina_id: resolution.ikiminaId,
          member_id: resolution.memberId,
          msisdn: msisdnMasked,
          msisdn_encrypted: msisdnEncrypted,
          msisdn_hash: msisdnHash,
          msisdn_masked: msisdnMasked,
          amount: parsed.amount,
          currency: "RWF",
          txn_id: parsed.txn_id,
          reference: parsed.reference,
          occurred_at: parsed.timestamp,
          status: resolution.status,
          source_id: smsId,
          confidence: parsed.confidence,
        })
        .select("id")
        .single();

      if (paymentInsert.error) {
        if (paymentInsert.error.code === "23505") {
          const { data: existing } = await supabase
            .schema("app")
            .from("payments")
            .select("id, sacco_id")
            .eq("txn_id", parsed.txn_id)
            .eq("amount", parsed.amount)
            .eq("occurred_at", parsed.timestamp)
            .maybeSingle();

          paymentId = (existing?.id as string) ?? null;
          resolvedSaccoId = (existing?.sacco_id as string) ?? resolvedSaccoId;
        } else {
          throw paymentInsert.error;
        }
      } else {
        paymentId = paymentInsert.data?.id as string;
      }

      await supabase
        .schema("app")
        .from("sms_inbox")
        .update({
          sacco_id: resolvedSaccoId,
          msisdn: msisdnMasked,
          msisdn_encrypted: msisdnEncrypted,
          msisdn_hash: msisdnHash,
          msisdn_masked: msisdnMasked,
          parsed_json: parsed,
          parse_source: "REGEX",
          confidence: parsed.confidence,
          status: "PARSED",
        })
        .eq("id", smsId);

      responseStatus = resolution.status;

      await writeAuditLog(supabase, {
        action: "SMS_REGEX_PARSED",
        saccoId: resolvedSaccoId ?? null,
        entity: "SMS_INBOX",
        entityId: smsId,
        diff: {
          paymentId,
          reference: parsed.reference,
          status: resolution.status,
        },
      });

      await recordMetric(supabase, "sms_regex_parsed", 1, {
        saccoId: resolvedSaccoId,
        status: resolution.status,
      });
    } else {
      await recordMetric(supabase, "sms_regex_pending", 1, {
        saccoId,
      });
    }

    return withCors(
      jsonResponse({
        id: smsId,
        status: responseStatus,
        paymentId,
        saccoId: resolvedSaccoId,
      })
    );
  } catch (error) {
    console.error("sms-inbox error:", error);
    const message = error instanceof z.ZodError ? "Invalid payload" : "Unhandled error";
    const status = error instanceof z.ZodError ? 400 : 500;
    return withCors(errorResponse(message, status));
  }
});
