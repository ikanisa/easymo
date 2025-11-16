import { supabase } from "../config.ts";

const INBOUND_SAMPLE_RATE = clamp01(
  Number(Deno.env.get("WA_INBOUND_LOG_SAMPLE_RATE") ?? "0") || 0,
);
const INBOUND_SNAPSHOT_LIMIT = Math.max(
  Number(Deno.env.get("WA_INBOUND_SNAPSHOT_LIMIT_BYTES") ?? "512") || 0,
  0,
);
const INBOUND_DEBUG_SNAPSHOT = ["1", "true"].includes(
  (Deno.env.get("WA_INBOUND_DEBUG_SNAPSHOT") ?? "").toLowerCase(),
);
const DEFAULT_DB_EVENT_PATTERNS = [
  "wa_inbound",
  "WEBHOOK_UNHANDLED_ERROR",
  "RETENTION_*",
  "HEALTH_CHECK_ERROR",
];
const DB_EVENT_PATTERNS = buildPatternList(
  Deno.env.get("WA_LOG_DB_EVENTS") ?? DEFAULT_DB_EVENT_PATTERNS.join(","),
);

type LogMeta = Record<string, unknown> & {
  headers?: Record<string, unknown>;
  statusCode?: number;
  status_code?: number;
  errorMessage?: string;
  error_message?: string;
};

async function insertLog(
  endpoint: string,
  payload: unknown,
  meta: LogMeta = {},
): Promise<void> {
  const {
    headers,
    statusCode,
    status_code,
    errorMessage,
    error_message,
    ...rest
  } = meta;
  const finalHeaders = headers ?? rest;
  const consoleEnvelope = {
    event: endpoint,
    payload,
    meta: {
      ...finalHeaders,
      status_code: statusCode ?? status_code ?? null,
      error_message: errorMessage ?? error_message ?? null,
    },
  };
  if (!shouldPersistEvent(endpoint)) {
    console.log(JSON.stringify({ ...consoleEnvelope, persisted: false }));
    return;
  }
  try {
    console.log(JSON.stringify({ ...consoleEnvelope, persisted: true }));
    await supabase.from("webhook_logs").insert({
      endpoint,
      payload,
      headers: finalHeaders,
      status_code: typeof statusCode === "number"
        ? statusCode
        : typeof status_code === "number"
        ? status_code
        : null,
      error_message: typeof errorMessage === "string"
        ? errorMessage
        : typeof error_message === "string"
        ? error_message
        : null,
    });
  } catch (err) {
    console.error("wa_webhook.log_insert_fail", endpoint, err);
  }
}

function shouldPersistEvent(endpoint: string): boolean {
  if (!DB_EVENT_PATTERNS.length) return false;
  return DB_EVENT_PATTERNS.some((pattern) => pattern.test(endpoint));
}

function buildPatternList(raw: string): RegExp[] {
  return raw.split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      if (token === "*") return /^.*$/;
      const escaped = token.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
      const withWildcards = escaped.replace(/\\\*/g, ".*");
      return new RegExp(`^${withWildcards}$`, "i");
    });
}

export async function logInbound(payload: unknown): Promise<void> {
  const summary = buildInboundSummary(payload);
  if (INBOUND_DEBUG_SNAPSHOT && shouldSampleInbound()) {
    const snapshot = safeStringify(payload);
    if (snapshot) {
      summary.sampled = true;
      summary.snapshot_bytes = snapshot.length;
      summary.snapshot = snapshot.slice(0, INBOUND_SNAPSHOT_LIMIT);
    }
  }
  await insertLog("wa_inbound", summary);
}

export async function logEvent(
  scope: string,
  payload: unknown,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await insertLog(scope, payload, extra);
}

export async function logStructuredEvent(
  event: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await insertLog(event, details);
}

export async function logMobilityMatch(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("MOBILITY_MATCH", payload);
}

export async function logOcrStatus(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("OCR_STATUS", payload);
}

export async function logWalletAdjust(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("WALLET_ADJUST", payload);
}

export async function logAdminAction(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("ADMIN_ACTION", payload);
}

export function logError(
  scope: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
  console.error(scope, error, extra);
}

function buildInboundSummary(payload: unknown): Record<string, unknown> {
  const obj = isRecord(payload) ? payload : {};
  const entries = Array.isArray(obj.entry) ? obj.entry : [];
  const changes = entries.flatMap((entry: any) => entry?.changes ?? []);
  const messages = changes.flatMap((change: any) =>
    change?.value?.messages ?? []
  );
  return {
    object: typeof obj.object === "string" ? obj.object : null,
    entry_count: entries.length,
    message_count: messages.length,
  };
}

function shouldSampleInbound(): boolean {
  if (INBOUND_SAMPLE_RATE <= 0) return false;
  if (INBOUND_SAMPLE_RATE >= 1) return true;
  return Math.random() < INBOUND_SAMPLE_RATE;
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
    );
  } catch (_err) {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
