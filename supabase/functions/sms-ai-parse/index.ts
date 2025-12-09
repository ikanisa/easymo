import { z } from "zod";
import { createServiceClient, errorResponse, jsonResponse, parseJwt } from "../_shared/mod.ts";
import { enforceIdentityRateLimit } from "../_shared/rate-limit.ts";
import { parseWithOpenAI } from "../_shared/sms-parser.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { resolveReference } from "../_shared/payments.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const requestSchema = z.object({
  smsInboxId: z.string().uuid(),
});

const loadUserProfile = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
) => {
  const { data, error } = await supabase
    .schema("app")
    .from("user_profiles")
    .select("sacco_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

serveWithObservability("sms-ai-parse", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST,OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const { smsInboxId } = requestSchema.parse(body);

    const auth = parseJwt(req.headers.get("authorization"));
    const supabase = createServiceClient();

    if (auth.userId) {
      const allowed = await enforceIdentityRateLimit(supabase, auth.userId, "/sms/ai-parse", {
        maxHits: 20,
        windowSeconds: 60,
      });

      if (!allowed) {
        return errorResponse("Rate limit exceeded", 429);
      }
    }

    const { data: sms, error: smsError } = await supabase
      .schema("app")
      .from("sms_inbox")
      .select("id, sacco_id, raw_text, parsed_json, parse_source, confidence, received_at")
      .eq("id", smsInboxId)
      .maybeSingle();

    if (smsError) {
      throw smsError;
    }

    if (!sms) {
      return errorResponse("SMS not found", 404);
    }

    let actingRole = auth.role ?? null;
    let actingSaccoId = sms.sacco_id as string | null;

    if (auth.userId) {
      const profile = await loadUserProfile(supabase, auth.userId);
      actingRole = (profile?.role as string | null) ?? actingRole;
      actingSaccoId = actingSaccoId ?? (profile?.sacco_id as string | null) ?? null;

      if (actingRole !== "SYSTEM_ADMIN") {
        if (!profile?.sacco_id) {
          return errorResponse("Profile missing SACCO assignment", 403);
        }

        if (sms.sacco_id && sms.sacco_id !== profile.sacco_id) {
          return errorResponse("Forbidden", 403);
        }
      }
    }

    const aiResult = await parseWithOpenAI(
      sms.raw_text as string,
      sms.received_at as string | undefined
    );
    const parsed = aiResult.parsed;

    const msisdnEncrypted = await encryptField(parsed.msisdn);
    const msisdnHash = await hashField(parsed.msisdn);
    const msisdnMasked = maskMsisdn(parsed.msisdn) ?? parsed.msisdn;

    const resolution = await resolveReference(supabase, parsed.reference, actingSaccoId);

    const { data: existingPayment, error: paymentLookupError } = await supabase
      .schema("app")
      .from("payments")
      .select("id")
      .eq("source_id", sms.id)
      .maybeSingle();

    if (paymentLookupError) {
      throw paymentLookupError;
    }

    let paymentId: string;

    if (existingPayment?.id) {
      const update = await supabase
        .schema("app")
        .from("payments")
        .update({
          sacco_id: resolution.saccoId ?? actingSaccoId,
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
          confidence: parsed.confidence,
          ai_version: aiResult.model,
        })
        .eq("id", existingPayment.id)
        .select("id")
        .single();

      if (update.error) {
        throw update.error;
      }

      paymentId = update.data.id as string;
    } else {
      const insert = await supabase
        .schema("app")
        .from("payments")
        .insert({
          channel: "SMS",
          sacco_id: resolution.saccoId ?? actingSaccoId,
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
          source_id: sms.id,
          confidence: parsed.confidence,
          ai_version: aiResult.model,
        })
        .select("id")
        .single();

      if (insert.error) {
        throw insert.error;
      }

      paymentId = insert.data.id as string;
    }

    await supabase
      .schema("app")
      .from("sms_inbox")
      .update({
        sacco_id: resolution.saccoId ?? actingSaccoId,
        parsed_json: parsed,
        parse_source: "AI",
        confidence: parsed.confidence,
        status: "PARSED",
        msisdn: msisdnMasked,
        msisdn_encrypted: msisdnEncrypted,
        msisdn_hash: msisdnHash,
        msisdn_masked: msisdnMasked,
      })
      .eq("id", sms.id);

    if (resolution.status !== "POSTED") {
      const { data: existingException } = await supabase
        .schema("app")
        .from("recon_exceptions")
        .select("id")
        .eq("payment_id", paymentId)
        .eq("status", "OPEN")
        .maybeSingle();

      if (!existingException?.id) {
        await supabase
          .schema("app")
          .from("recon_exceptions")
          .insert({
            payment_id: paymentId,
            reason: resolution.ikiminaId ? "NAME_MISMATCH" : "UNKNOWN_REF",
            status: "OPEN",
          });
      }
    }

    await writeAuditLog(supabase, {
      action: "AI_PARSE_USED",
      saccoId: resolution.saccoId ?? actingSaccoId ?? null,
      entity: "SMS_INBOX",
      entityId: sms.id as string,
      diff: {
        paymentId,
        confidence: parsed.confidence,
        model: aiResult.model,
      },
      actorId: auth.userId ?? null,
    });

    await recordMetric(supabase, "sms_ai_parse", 1, {
      saccoId: resolution.saccoId ?? actingSaccoId,
      status: resolution.status,
      model: aiResult.model,
    });

    return jsonResponse({
      smsInboxId,
      paymentId,
      status: resolution.status,
      confidence: parsed.confidence,
      model: aiResult.model,
    });
  } catch (error) {
    console.error("sms-ai-parse error", error);
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError ? "Invalid payload" : "Unhandled error";
    return errorResponse(message, status);
  }
});
