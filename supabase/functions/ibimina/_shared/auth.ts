import { requireEnv, verifyHmacSignature } from "./mod.ts";

const encoder = new TextEncoder();

export type HmacFailureReason =
  | "missing_signature"
  | "missing_timestamp"
  | "stale_timestamp"
  | "invalid_signature";

export interface HmacValidationOptions {
  signatureHeader?: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
  secretEnv?: string;
  context?: string;
  rawBody?: Uint8Array;
}

export type HmacValidationResult =
  | { ok: true; rawBody: Uint8Array; timestamp: string }
  | { ok: false; reason: HmacFailureReason };

const buildMessage = (timestamp: string, context: string, body: Uint8Array) => {
  const timestampBytes = encoder.encode(timestamp);
  const contextBytes = encoder.encode(context);
  const message = new Uint8Array(timestampBytes.length + contextBytes.length + body.length);
  message.set(timestampBytes, 0);
  message.set(contextBytes, timestampBytes.length);
  message.set(body, timestampBytes.length + contextBytes.length);
  return message;
};

export const validateHmacRequest = async (
  req: Request,
  options: HmacValidationOptions = {}
): Promise<HmacValidationResult> => {
  const signatureHeader = options.signatureHeader ?? "x-signature";
  const timestampHeader = options.timestampHeader ?? "x-timestamp";
  const toleranceSeconds = options.toleranceSeconds ?? 300; // five minutes
  const signature = req.headers.get(signatureHeader);

  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }

  const timestamp = req.headers.get(timestampHeader);
  if (!timestamp) {
    return { ok: false, reason: "missing_timestamp" };
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (Number.isNaN(parsedTimestamp)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const now = Date.now();
  if (Math.abs(now - parsedTimestamp) > toleranceSeconds * 1000) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const secret = requireEnv(options.secretEnv ?? "HMAC_SHARED_SECRET");
  const rawBody = options.rawBody ?? new Uint8Array(await req.arrayBuffer());
  const context = options.context ?? `${req.method.toUpperCase()}:${new URL(req.url).pathname}`;
  const message = buildMessage(timestamp, context, rawBody);

  if (!verifyHmacSignature(secret, message, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, rawBody, timestamp };
};
