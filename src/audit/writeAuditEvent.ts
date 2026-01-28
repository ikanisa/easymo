import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "./logger";
import { createHash } from "crypto";

const log = createLogger({ service: "audit" });

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

/**
 * Hash object for audit trail (non-reversible)
 */
function hashObject(obj: Record<string, unknown> | undefined): string | null {
  if (!obj || Object.keys(obj).length === 0) return null;
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

/**
 * Mask phone number for logging (privacy)
 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  return "***" + phone.slice(-3);
}

export type AuditEventInput = {
  request_id?: string;
  conversation_id?: string;
  event_type: string;
  actor?: string;
  tool_name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  idempotency_key?: string;
  duration_ms?: number;
  success?: boolean;
  error_message?: string;
};

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const startTime = Date.now();
  const client = getClient();

  // Always log structured event (even if DB unavailable)
  const logPayload = {
    msg: "audit_event",
    request_id: event.request_id,
    conversation_id: event.conversation_id,
    event_type: event.event_type,
    actor: event.actor ?? "system",
    tool_name: event.tool_name,
    severity: event.success === false ? "error" : "info",
    idempotency_key: event.idempotency_key,
    timing_ms: event.duration_ms,
  };

  if (!client) {
    log.info({ ...logPayload, db_skipped: true });
    return;
  }

  const payload = {
    request_id: event.request_id ?? null,
    conversation_id: event.conversation_id ?? null,
    event_type: event.event_type,
    actor: event.actor ?? "system",
    tool_name: event.tool_name ?? null,
    idempotency_key: event.idempotency_key ?? null,
    input_hash: hashObject(event.input),
    output_hash: hashObject(event.output),
    duration_ms: event.duration_ms ?? null,
    success: event.success ?? true,
    details: {
      input: event.input ?? {},
      output: event.output ?? {},
    },
    error_message: event.error_message ?? null,
  };

  const { error } = await client.from("moltbot_audit_events").insert(payload);

  if (error) {
    log.warn({
      ...logPayload,
      msg: "audit_event_insert_failed",
      error: error.message,
      insert_duration_ms: Date.now() - startTime,
    });
  } else {
    log.info({
      ...logPayload,
      insert_duration_ms: Date.now() - startTime,
    });
  }
}
