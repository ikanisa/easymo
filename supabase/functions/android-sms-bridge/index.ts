import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateHmacRequest } from "../_shared/auth.ts";
import { parseWithRegex, parseWithOpenAI } from "../_shared/sms-parser.ts";
import { parseWithGemini, geminiToStandardFormat } from "../_shared/gemini-parser.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { postToLedger } from "../_shared/ledger.ts";
import { errorCorsResponse, jsonCorsResponse, preflightResponse } from "../_shared/http.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const decoder = new TextDecoder();

interface AndroidBridgeRequest {
  sender_id: string;
  raw_message: string;
  received_at: number; // Unix timestamp in milliseconds
  device_id: string;
  sacco_id?: string;
  // Optional heartbeat data
  battery_level?: number;
  network_type?: string;
  signal_strength?: number;
  pending_sms_count?: number;
  app_version?: string;
}

/**
 * Android SMS Bridge Gateway
 * Receives SMS messages from Android bridge app, parses them using AI,
 * and creates payment records
 */
serveWithObservability("android-sms-bridge", async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate HMAC signature
    const validation = await validateHmacRequest(req, {
      secretEnv: "ANDROID_BRIDGE_HMAC_SECRET",
    });

    if (!validation.ok) {
      console.warn("android-sms-bridge.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return jsonCorsResponse({ success: false, error: "invalid_signature" }, { status });
    }

    let payload: AndroidBridgeRequest;
    try {
      payload = JSON.parse(decoder.decode(validation.rawBody)) as AndroidBridgeRequest;
    } catch (error) {
      console.warn("android-sms-bridge.json_parse_failed", { error: String(error) });
      return jsonCorsResponse({ success: false, error: "invalid_payload" }, { status: 400 });
    }

    const {
      sender_id,
      raw_message,
      received_at,
      device_id,
      sacco_id,
      battery_level,
      network_type,
      signal_strength,
      pending_sms_count,
      app_version,
    } = payload;

    // Validate required fields
    if (!sender_id || !raw_message || !received_at || !device_id) {
      return jsonCorsResponse({ success: false, error: "missing_required_fields" }, { status: 400 });
    }

    // Rate limiting per device
    const allowed = await enforceRateLimit(supabase, `android-bridge:${device_id}`, {
      maxHits: 100,
      windowSeconds: 60,
    });

    if (!allowed) {
      return errorCorsResponse("Rate limit exceeded", 429);
    }

    console.log("Android bridge SMS received", {
      device_id,
      sender_id,
      message_length: raw_message.length,
      sacco_id,
    });

    // Step 1: Update or create device record
    const { data: existingDevice } = await supabase
      .from("gateway_devices")
      .select("id, sacco_id")
      .eq("device_id", device_id)
      .maybeSingle();

    if (!existingDevice) {
      // Create new device
      await supabase.from("gateway_devices").insert({
        device_id,
        sacco_id: sacco_id || null,
        device_name: `Android Device ${device_id.slice(0, 8)}`,
        last_heartbeat_at: new Date().toISOString(),
        is_active: true,
      });
      console.log("Created new gateway device", { device_id });
    } else {
      // Update heartbeat timestamp
      await supabase
        .from("gateway_devices")
        .update({
          last_heartbeat_at: new Date().toISOString(),
          is_active: true,
          sacco_id: sacco_id || existingDevice.sacco_id,
        })
        .eq("device_id", device_id);
    }

    // Step 2: Record heartbeat if data provided
    if (battery_level !== undefined || network_type || signal_strength !== undefined) {
      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;

      await supabase.from("gateway_heartbeats").insert({
        device_id,
        battery_level: battery_level ?? null,
        network_type: network_type ?? null,
        signal_strength: signal_strength ?? null,
        pending_sms_count: pending_sms_count ?? 0,
        ip_address: clientIp,
        app_version: app_version ?? null,
      });
    }

    // Step 3: Check for known MoMo senders (security filter)
    const knownSenders = [
      "MTN MobileMoney",
      "MTN",
      "MTN Money",
      "Airtel Money",
      "Airtel",
      "M-PESA",
      "MPESA",
    ];

    const isKnownSender = knownSenders.some((known) =>
      sender_id.toLowerCase().includes(known.toLowerCase())
    );

    if (!isKnownSender) {
      console.warn("Unknown sender ID, rejecting", { sender_id, device_id });
      
      // Log it but don't process
      await supabase.from("raw_sms_logs").insert({
        device_id,
        sender_id,
        raw_message,
        received_at: new Date(received_at).toISOString(),
        status: "FAILED",
        error_message: "Unknown sender ID (not a known MoMo provider)",
      });

      return jsonCorsResponse(
        {
          success: false,
          error: "unknown_sender",
          message: "SMS sender not recognized as a known MoMo provider",
        },
        { status: 400 }
      );
    }

    // Step 4: Parse SMS using regex -> Gemini -> OpenAI fallback chain
    const receivedAtIso = new Date(received_at).toISOString();
    let parsed = parseWithRegex(raw_message, receivedAtIso);
    let parseSource: "REGEX" | "GEMINI" | "OPENAI" = "REGEX";
    let modelUsed: string | null = null;

    if (!parsed || parsed.confidence < 0.9) {
      console.log("Regex failed or low confidence, trying Gemini");
      
      try {
        const geminiResult = await parseWithGemini(raw_message);
        parsed = geminiToStandardFormat(geminiResult.parsed);
        parseSource = "GEMINI";
        modelUsed = geminiResult.model;
      } catch (geminiError) {
        console.error("Gemini parse failed, falling back to OpenAI", geminiError);

        try {
          const openAiResult = await parseWithOpenAI(raw_message, receivedAtIso);
          parsed = openAiResult.parsed;
          parseSource = "OPENAI";
          modelUsed = openAiResult.model;
        } catch (openAiError) {
          console.error("OpenAI parse also failed", openAiError);

          // Log the failure
          await supabase.from("raw_sms_logs").insert({
            device_id,
            sender_id,
            raw_message,
            received_at: receivedAtIso,
            status: "FAILED",
            error_message: `All parsers failed. Gemini: ${geminiError instanceof Error ? geminiError.message : "unknown"}. OpenAI: ${openAiError instanceof Error ? openAiError.message : "unknown"}`,
          });

          return jsonCorsResponse(
            {
              success: false,
              error: "parse_failed",
              message: "Unable to parse SMS with any available parser",
            },
            { status: 500 }
          );
        }
      }
    }

    console.log("SMS parsed successfully", {
      parseSource,
      confidence: parsed.confidence,
      model: modelUsed,
    });

    // Step 5: Encrypt and hash MSISDN
    const encryptedMsisdn = await encryptField(parsed.msisdn);
    const msisdnHash = await hashField(parsed.msisdn);
    const maskedMsisdn = maskMsisdn(parsed.msisdn) ?? parsed.msisdn;

    // Step 6: Check for duplicates
    const { data: duplicate } = await supabase
      .from("payments")
      .select("id")
      .eq("txn_id", parsed.txn_id)
      .maybeSingle();

    if (duplicate?.id) {
      console.log("Duplicate transaction detected", { txn_id: parsed.txn_id });

      await supabase.from("raw_sms_logs").insert({
        device_id,
        sender_id,
        raw_message,
        received_at: receivedAtIso,
        processed_at: new Date().toISOString(),
        parse_source: parseSource,
        parse_confidence: parsed.confidence,
        parsed_json: parsed,
        payment_id: duplicate.id,
        status: "DUPLICATE",
      });

      await recordMetric(supabase, "sms_duplicates", 1, {
        device_id,
        parseSource,
      });

      return jsonCorsResponse({
        success: true,
        status: "DUPLICATE",
        payment_id: duplicate.id,
        message: "Transaction already processed",
      });
    }

    // Step 7: Map to SACCO/Ikimina/Member based on reference
    const deviceSaccoId = existingDevice?.sacco_id || sacco_id;
    let mappedSaccoId = deviceSaccoId;
    let ikiminaId = null;
    let memberId = null;
    let paymentStatus = "PENDING";

    if (parsed.reference) {
      // Parse reference: DISTRICT.SACCO.GROUP(.MEMBER)?
      const refParts = parsed.reference.split(".");

      if (refParts.length >= 3) {
        const groupCode = refParts[2];

        // Find Ikimina by code
        const { data: ikimina } = await supabase
          .from("ikimina")
          .select("id, sacco_id")
          .eq("code", groupCode)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (ikimina) {
          mappedSaccoId = ikimina.sacco_id;
          ikiminaId = ikimina.id;

          // If member code provided, find member
          if (refParts.length >= 4) {
            const memberCode = refParts[3];

            const { data: member } = await supabase
              .from("members")
              .select("id")
              .eq("ikimina_id", ikimina.id)
              .eq("member_code", memberCode)
              .eq("status", "ACTIVE")
              .maybeSingle();

            if (member) {
              memberId = member.id;
              paymentStatus = "POSTED"; // Auto-approve when fully matched
            } else {
              paymentStatus = "UNALLOCATED"; // Group matched but not member
            }
          } else {
            paymentStatus = "UNALLOCATED"; // No member code provided
          }
        }
      }
    }

    // Step 8: Create raw SMS log entry
    const { data: smsLog, error: smsLogError } = await supabase
      .from("raw_sms_logs")
      .insert({
        device_id,
        sender_id,
        raw_message,
        received_at: receivedAtIso,
        processed_at: new Date().toISOString(),
        parse_source: parseSource,
        parse_confidence: parsed.confidence,
        parsed_json: parsed,
        status: "PARSED",
      })
      .select()
      .single();

    if (smsLogError) {
      console.error("Error creating SMS log", smsLogError);
      throw smsLogError;
    }

    // Step 9: Create Payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        channel: "SMS",
        sacco_id: mappedSaccoId,
        ikimina_id: ikiminaId,
        member_id: memberId,
        msisdn: maskedMsisdn,
        msisdn_encrypted: encryptedMsisdn,
        msisdn_hash: msisdnHash,
        msisdn_masked: maskedMsisdn,
        amount: parsed.amount,
        currency: "RWF",
        txn_id: parsed.txn_id,
        reference: parsed.reference,
        occurred_at: parsed.timestamp,
        status: paymentStatus,
        source_id: null, // Not linked to sms_inbox table
        ai_version: parseSource === "REGEX" ? null : `${parseSource}-${modelUsed ?? "unknown"}`,
        confidence: parsed.confidence,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment", paymentError);
      throw paymentError;
    }

    // Update SMS log with payment ID
    await supabase
      .from("raw_sms_logs")
      .update({ payment_id: payment.id })
      .eq("id", smsLog.id);

    console.log("Payment created", { id: payment.id, status: paymentStatus });

    // Step 10: Post to ledger if auto-approved
    if (paymentStatus === "POSTED") {
      await postToLedger(supabase, {
        id: payment.id,
        sacco_id: payment.sacco_id,
        ikimina_id: payment.ikimina_id,
        member_id: payment.member_id,
        amount: payment.amount,
        currency: payment.currency,
        txn_id: payment.txn_id,
      });
    }

    // Step 11: Audit log
    await writeAuditLog(supabase, {
      action: "ANDROID_SMS_RECEIVED",
      entity: "RAW_SMS_LOGS",
      entityId: smsLog.id,
      diff: {
        device_id,
        payment_id: payment.id,
        sacco_id: mappedSaccoId,
        parseSource,
        status: paymentStatus,
      },
    });

    // Step 12: Record metrics
    await recordMetric(supabase, "android_sms_received", 1, {
      device_id,
      parseSource,
      status: paymentStatus,
      model: modelUsed ?? null,
    });

    return jsonCorsResponse({
      success: true,
      sms_log_id: smsLog.id,
      payment_id: payment.id,
      status: paymentStatus,
      parse_source: parseSource,
      confidence: parsed.confidence,
      message: `SMS processed successfully via ${parseSource}`,
    });
  } catch (error) {
    console.error("Android bridge error", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonCorsResponse(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});
