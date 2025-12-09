import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serveWithObservability } from "../_shared/observability.ts";
import { preflightResponse, jsonCorsResponse, errorCorsResponse } from "../_shared/http.ts";

const decoder = new TextDecoder();

/**
 * Expected incoming payload from MomoTerminal Android app
 */
interface MomoSmsPayload {
  source: "momoterminal";
  version: string;
  timestamp: string;
  phone_number: string;      // MoMo recipient phone
  sender: string;            // SMS sender (e.g., "MTN MoMo")
  message: string;           // Raw SMS content
  device_id: string;
  signature: string;         // HMAC-SHA256 signature
}

/**
 * Parsed SMS data structure
 */
interface ParsedSmsData {
  amount: number | null;
  senderName: string | null;
  transactionId: string | null;
  provider: string | null;
}

/**
 * MoMo SMS Webhook Endpoint
 * 
 * Receives SMS messages relayed from MomoTerminal Android app,
 * verifies authenticity, parses content, and stores for payment matching.
 * 
 * Expected headers:
 * - X-Momo-Signature: HMAC-SHA256 signature of request body
 * - X-Momo-Timestamp: Unix timestamp (reject if > 5 min old)
 * - X-Momo-Device-Id: Device identifier
 * - Authorization: Bearer {api_key}
 */
serveWithObservability("momo-sms-webhook", async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    // 1. Extract headers
    const signature = req.headers.get("x-momo-signature");
    const timestamp = req.headers.get("x-momo-timestamp");
    const deviceId = req.headers.get("x-momo-device-id");
    const authHeader = req.headers.get("authorization");

    // 2. Validate required headers
    if (!signature || !timestamp || !authHeader) {
      console.warn("momo-sms-webhook.missing_headers", {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        hasAuth: !!authHeader,
      });
      return jsonCorsResponse(
        { error: "Missing required headers" },
        { status: 401 }
      );
    }

    // 3. Check timestamp freshness (5 minute window)
    const requestTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - requestTime);
    
    if (timeDiff > 300) {
      console.warn("momo-sms-webhook.stale_request", {
        requestTime,
        now,
        diffSeconds: timeDiff,
      });
      return jsonCorsResponse(
        { error: "Request expired" },
        { status: 401 }
      );
    }

    // 4. Parse body
    const body = await req.text();
    let payload: MomoSmsPayload;
    
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error("momo-sms-webhook.json_parse_error", { error: String(error) });
      return jsonCorsResponse(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // 5. Validate payload structure
    if (!payload.phone_number || !payload.message || !payload.device_id) {
      console.warn("momo-sms-webhook.invalid_payload", {
        hasPhoneNumber: !!payload.phone_number,
        hasMessage: !!payload.message,
        hasDeviceId: !!payload.device_id,
      });
      return jsonCorsResponse(
        { error: "Missing required payload fields" },
        { status: 400 }
      );
    }

    // 6. Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 7. Get webhook config for this phone number
    const { data: config, error: configError } = await supabase
      .from("momo_webhook_config")
      .select("*")
      .eq("momo_phone_number", payload.phone_number)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.warn("momo-sms-webhook.config_not_found", {
        phoneNumber: payload.phone_number,
        error: configError?.message,
      });
      return jsonCorsResponse(
        { error: "Webhook not configured for this phone number" },
        { status: 403 }
      );
    }

    // 8. Verify HMAC signature
    const isValidSignature = await verifyHmacSignature(
      body,
      signature,
      config.webhook_secret
    );

    if (!isValidSignature) {
      console.warn("momo-sms-webhook.invalid_signature", {
        phoneNumber: payload.phone_number,
        deviceId: payload.device_id,
      });
      return jsonCorsResponse(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 9. Parse SMS content
    const parsed = parseMomoSms(payload.message);

    console.log("momo-sms-webhook.sms_parsed", {
      phoneNumber: payload.phone_number,
      provider: parsed.provider,
      amount: parsed.amount,
      hasTransactionId: !!parsed.transactionId,
    });

    // 10. Insert into database (trigger will auto-match)
    const { data: insertedSms, error: insertError } = await supabase
      .from("momo_sms_inbox")
      .insert({
        phone_number: payload.phone_number,
        sender: payload.sender,
        raw_message: payload.message,
        parsed_amount: parsed.amount,
        parsed_sender_name: parsed.senderName,
        parsed_transaction_id: parsed.transactionId,
        parsed_provider: parsed.provider,
        signature: signature,
        device_id: deviceId || payload.device_id,
        received_at: new Date(parseInt(payload.timestamp) * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("momo-sms-webhook.insert_error", {
        error: insertError.message,
        code: insertError.code,
      });
      return jsonCorsResponse(
        { error: "Failed to store SMS" },
        { status: 500 }
      );
    }

    console.log("momo-sms-webhook.success", {
      id: insertedSms.id,
      matched: insertedSms.matched_payment_id !== null,
      processed: insertedSms.processed,
    });

    return jsonCorsResponse({
      success: true,
      id: insertedSms.id,
      matched: insertedSms.matched_payment_id !== null,
      confidence: insertedSms.match_confidence,
    }, { status: 200 });

  } catch (error) {
    console.error("momo-sms-webhook.unexpected_error", {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorCorsResponse("Internal server error", 500);
  }
});

/**
 * Verify HMAC-SHA256 signature
 */
async function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return signature.toLowerCase() === expectedSignature.toLowerCase();
  } catch (error) {
    console.error("momo-sms-webhook.signature_verification_error", { error: String(error) });
    return false;
  }
}

/**
 * Parse Mobile Money SMS to extract payment details
 * 
 * Supports formats from:
 * - MTN MoMo (Ghana/Rwanda)
 * - Vodafone Cash (Ghana)
 * - AirtelTigo (Ghana)
 */
function parseMomoSms(message: string): ParsedSmsData {
  let amount: number | null = null;
  let senderName: string | null = null;
  let transactionId: string | null = null;
  let provider: string | null = null;

  // Normalize message for easier parsing
  const normalizedMsg = message.replace(/\s+/g, " ").trim();

  // MTN MoMo pattern
  // Example: "You have received 5,000.00 GHS from JOHN DOE. Transaction ID: 123456789. Your new balance is..."
  const mtnMatch = normalizedMsg.match(/received\s+([\d,]+(?:\.\d{2})?)\s*(?:GHS|RWF|GHC)/i);
  const mtnSenderMatch = normalizedMsg.match(/from\s+([A-Z\s]+?)(?:\.|,|Transaction)/i);
  const mtnTxnMatch = normalizedMsg.match(/Transaction\s+ID[:\s]+(\w+)/i);
  
  if (mtnMatch) {
    amount = parseFloat(mtnMatch[1].replace(/,/g, ""));
    provider = "mtn";
    
    if (mtnSenderMatch) {
      senderName = mtnSenderMatch[1].trim();
    }
    if (mtnTxnMatch) {
      transactionId = mtnTxnMatch[1];
    }
  }

  // Vodafone Cash pattern
  // Example: "You have received GHS 5,000.00 from JOHN DOE. Ref: VC123456..."
  if (!amount) {
    const vodaMatch = normalizedMsg.match(/received\s+(?:GHS|RWF|GHC)\s*([\d,]+(?:\.\d{2})?)/i);
    const vodaSenderMatch = normalizedMsg.match(/from\s+([A-Z\s]+?)(?:\.|,|Ref)/i);
    const vodaRefMatch = normalizedMsg.match(/Ref[:\s]+(\w+)/i);
    
    if (vodaMatch) {
      amount = parseFloat(vodaMatch[1].replace(/,/g, ""));
      provider = "vodafone";
      
      if (vodaSenderMatch) {
        senderName = vodaSenderMatch[1].trim();
      }
      if (vodaRefMatch) {
        transactionId = vodaRefMatch[1];
      }
    }
  }

  // AirtelTigo pattern
  // Example: "You have received 5000 GHS from JOHN DOE. TxnID: AT123456..."
  if (!amount) {
    const atMatch = normalizedMsg.match(/received\s+([\d,]+)\s*(?:GHS|RWF|GHC)/i);
    const atSenderMatch = normalizedMsg.match(/from\s+([A-Z\s]+?)(?:\.|,|TxnID)/i);
    const atTxnMatch = normalizedMsg.match(/TxnID[:\s]+(\w+)/i);
    
    if (atMatch) {
      amount = parseFloat(atMatch[1].replace(/,/g, ""));
      provider = "airteltigo";
      
      if (atSenderMatch) {
        senderName = atSenderMatch[1].trim();
      }
      if (atTxnMatch) {
        transactionId = atTxnMatch[1];
      }
    }
  }

  // Generic fallback for any "received X from Y" pattern
  if (!amount) {
    const genericMatch = normalizedMsg.match(/received\s+(?:GHS|RWF|GHC)?\s*([\d,]+(?:\.\d{2})?)/i);
    const genericSenderMatch = normalizedMsg.match(/from\s+([A-Z\s]+?)(?:\.|,)/i);
    
    if (genericMatch) {
      amount = parseFloat(genericMatch[1].replace(/,/g, ""));
      provider = "unknown";
      
      if (genericSenderMatch) {
        senderName = genericSenderMatch[1].trim();
      }
    }
  }

  return {
    amount,
    senderName,
    transactionId,
    provider,
  };
}
