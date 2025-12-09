import { requireEnv } from "./mod.ts";

export interface ParsedTransaction {
  msisdn: string;
  amount: number;
  txn_id: string;
  timestamp: string;
  reference?: string;
  payer_name?: string;
  confidence: number;
}

export interface OpenAIResult {
  parsed: ParsedTransaction;
  model: string | null;
}

const MTN_PATTERNS: RegExp[] = [
  /You have received RWF ([0-9,]+) from (\d{10}) \(([^)]+)\)\. Ref:? ([A-Z0-9.]+)\. Balance: RWF [0-9,]+\. Txn ID:? ([A-Z0-9]+)/i,
  /Received RWF ([0-9,]+) from (\+?250\d{9})\. Ref:? ([A-Z0-9.]+)\. ID:? ([A-Z0-9]+)/i,
  /RWF ([0-9,]+) received from (\d{10})\. Reference:? ([A-Z0-9.]+)\. Transaction:? ([A-Z0-9]+)/i,
];

const toIsoString = (value?: string) => {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

const normalizeMsisdn = (value: string) => {
  const cleaned = value.replace(/[^0-9+]/g, "");
  if (!cleaned) {
    return value;
  }

  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/[^0-9]/g, "");
    return `+${digits}`;
  }

  if (cleaned.startsWith("2507")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("07")) {
    return `+250${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return `+250${cleaned}`;
  }

  return value;
};

const clampConfidence = (value: unknown, fallback: number) => {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (Number.isFinite(num)) {
    return Math.min(Math.max(num, 0), 1);
  }
  return fallback;
};

export const parseWithRegex = (rawText: string, receivedAt?: string): ParsedTransaction | null => {
  for (const pattern of MTN_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      const amount = Number.parseInt(match[1].replace(/,/g, ""), 10);
      const msisdn = normalizeMsisdn(match[2]);
      const reference = match[3] || match[4];
      const txnId = match[4] || match[5];
      const payerMatch = rawText.match(/\(([^)]+)\)/);
      const payerName = payerMatch ? payerMatch[1] : undefined;

      return {
        msisdn,
        amount,
        txn_id: txnId,
        timestamp: toIsoString(receivedAt),
        payer_name: payerName,
        reference,
        confidence: 0.95,
      };
    }
  }

  return null;
};

type OpenAIJsonOutput = {
  msisdn: string;
  amount: number | string;
  txn_id?: string;
  txnId?: string;
  timestamp?: string;
  payer_name?: string | null;
  payerName?: string | null;
  reference?: string | null;
  confidence?: number | string | null;
};

const extractJsonOutput = (payload: any): OpenAIJsonOutput | null => {
  if (payload?.output && Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (item?.type === "output_json" && item.json) {
        return item.json as OpenAIJsonOutput;
      }
      if (item?.type === "output_text" && typeof item.text === "string") {
        try {
          return JSON.parse(item.text) as OpenAIJsonOutput;
        } catch {
          // continue
        }
      }
    }
  }

  if (payload?.response?.output_text && Array.isArray(payload.response.output_text)) {
    for (const item of payload.response.output_text) {
      if (typeof item === "string") {
        try {
          return JSON.parse(item) as OpenAIJsonOutput;
        } catch {
          // continue
        }
      }
    }
  }

  if (payload?.choices && Array.isArray(payload.choices)) {
    const choice = payload.choices[0];
    const content = choice?.message?.content;
    if (typeof content === "string") {
      try {
        return JSON.parse(content) as OpenAIJsonOutput;
      } catch {
        // ignore
      }
    }
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string") {
          try {
            return JSON.parse(block.text) as OpenAIJsonOutput;
          } catch {
            // continue
          }
        }
      }
    }
  }

  return null;
};

export const parseWithOpenAI = async (
  rawText: string,
  receivedAt?: string
): Promise<OpenAIResult> => {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_RESPONSES_MODEL") ?? "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Extract MTN Rwanda MoMo transaction details from raw SMS. Return only valid JSON that matches the provided schema.",
        },
        {
          role: "user",
          content: `Extract the transaction details from the following SMS. If a field is missing, return null. SMS: ${rawText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "momo_transaction",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["msisdn", "amount", "txn_id"],
            properties: {
              msisdn: {
                description: "Payer MSISDN in E.164 format (e.g. +2507XXXXXXX)",
                type: "string",
                pattern: "^\\+?2507\\d{8}$",
              },
              amount: {
                description: "Transaction amount in RWF",
                type: ["integer", "string"],
                pattern: "^\\d+$",
              },
              txn_id: {
                description: "MoMo transaction identifier",
                type: "string",
                minLength: 3,
              },
              timestamp: {
                description: "Timestamp of the transaction (ISO8601)",
                type: ["string", "null"],
              },
              payer_name: {
                description: "Optional payer name",
                type: ["string", "null"],
              },
              reference: {
                description: "Optional reference code",
                type: ["string", "null"],
              },
              confidence: {
                description: "Model confidence between 0 and 1",
                type: ["number", "string", "null"],
              },
            },
          },
        },
      },
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText.slice(0, 80)}`);
  }

  const payload = await response.json();
  const jsonOutput = extractJsonOutput(payload);

  if (!jsonOutput) {
    throw new Error("Unable to parse OpenAI structured output");
  }

  const msisdn = normalizeMsisdn(String(jsonOutput.msisdn));
  const amount = Number.parseInt(String(jsonOutput.amount).replace(/,/g, ""), 10);
  const txnId = (jsonOutput.txn_id ?? jsonOutput.txnId ?? "").toString().trim();

  if (!msisdn || Number.isNaN(amount) || !txnId) {
    throw new Error("OpenAI response missing required fields");
  }

  const timestamp = jsonOutput.timestamp
    ? toIsoString(jsonOutput.timestamp)
    : toIsoString(receivedAt);

  const confidence = clampConfidence(jsonOutput.confidence, 0.85);

  const transaction: ParsedTransaction = {
    msisdn,
    amount,
    txn_id: txnId,
    timestamp,
    payer_name: (jsonOutput.payer_name ?? jsonOutput.payerName ?? undefined) || undefined,
    reference: jsonOutput.reference ?? undefined,
    confidence,
  };

  return { parsed: transaction, model: payload.model ?? model ?? null };
};
