import { requireEnv } from "./mod.ts";

export interface GeminiParsedTransaction {
  transaction_id: string;
  amount: number;
  currency: string;
  payer_name: string;
  payer_phone: string;
  timestamp: string;
  type: "PAYMENT_RECEIVED" | "PAYMENT_SENT" | "UNKNOWN";
}

export interface GeminiParseResult {
  parsed: GeminiParsedTransaction;
  model: string;
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Parse a Mobile Money SMS using Google Gemini 1.5 Flash with structured output
 * @param rawMessage - The raw SMS message text
 * @returns Parsed transaction details
 */
export async function parseWithGemini(rawMessage: string): Promise<GeminiParseResult> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash";

  const systemPrompt = `You are a specialized Mobile Money SMS parser for Rwanda (MTN, Airtel) and Kenya (M-PESA).
Extract transaction details from payment SMS messages and return strictly valid JSON.

Rules:
- Transaction IDs are alphanumeric codes (e.g., MP241126ABC, RWF123456)
- Phone numbers should be in E.164 format (+250... or +254...)
- Amount must be a positive number
- Currency is typically "RWF" for Rwanda or "KES" for Kenya
- Type should be "PAYMENT_RECEIVED" if money was received, "PAYMENT_SENT" if money was sent
- If any required field is missing or uncertain, use best effort extraction
- Timestamp should be ISO 8601 format if available in the message`;

  const userPrompt = `Extract the following fields from this payment SMS:
- Transaction ID
- Amount (numeric value only, no currency symbol)
- Currency (RWF, KES, etc.)
- Payer Name
- Payer Phone (in E.164 format like +250...)
- Date/Time (convert to ISO 8601 format)
- Payment Type (PAYMENT_RECEIVED, PAYMENT_SENT, or UNKNOWN)

Return the result strictly as JSON matching this schema:
{
  "transaction_id": "string",
  "amount": number,
  "currency": "string",
  "payer_name": "string",
  "payer_phone": "string",
  "timestamp": "string (ISO 8601)",
  "type": "PAYMENT_RECEIVED" | "PAYMENT_SENT" | "UNKNOWN"
}

SMS message:
${rawMessage}`;

  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: systemPrompt + "\n\n" + userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error", response.status, errorText);
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 100)}`);
  }

  const result = await response.json();

  // Extract JSON from Gemini response
  const candidate = result.candidates?.[0];
  const content = candidate?.content;
  const parts = content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error("Gemini returned no content");
  }

  const text = parts[0].text;
  if (!text) {
    throw new Error("Gemini returned empty text");
  }

  let parsed: GeminiParsedTransaction;
  try {
    // Try to parse the response as JSON
    parsed = JSON.parse(text) as GeminiParsedTransaction;
  } catch (error) {
    console.error("Failed to parse Gemini JSON response", error, text);
    throw new Error(`Failed to parse Gemini JSON: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Validate required fields
  if (!parsed.transaction_id || !parsed.amount || !parsed.payer_phone) {
    throw new Error(
      `Gemini response missing required fields: ${JSON.stringify({
        has_txn: !!parsed.transaction_id,
        has_amount: !!parsed.amount,
        has_phone: !!parsed.payer_phone,
      })}`
    );
  }

  // Normalize amount to number
  if (typeof parsed.amount === "string") {
    parsed.amount = Number.parseFloat(parsed.amount.replace(/,/g, ""));
  }

  // Validate amount
  if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
    throw new Error(`Invalid amount from Gemini: ${parsed.amount}`);
  }

  return {
    parsed,
    model: model,
  };
}

/**
 * Convert GeminiParsedTransaction to the standard ParsedTransaction format
 * used by the existing SMS parser
 */
export function geminiToStandardFormat(gemini: GeminiParsedTransaction) {
  return {
    msisdn: gemini.payer_phone,
    amount: Math.floor(gemini.amount), // Convert to integer for consistency
    txn_id: gemini.transaction_id,
    timestamp: gemini.timestamp || new Date().toISOString(),
    payer_name: gemini.payer_name || undefined,
    reference: undefined, // Gemini doesn't extract reference codes by default
    confidence: 0.85, // Gemini confidence score
  };
}
