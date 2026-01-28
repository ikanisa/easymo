import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { childLogger } from "@easymo/commons";

const log = childLogger({ service: "audit" });

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export type AuditEventInput = {
  request_id?: string;
  conversation_id?: string;
  event_type: string;
  actor?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  idempotency_key?: string;
  duration_ms?: number;
};

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const client = getClient();
  if (!client) {
    log.info({ msg: "audit_event_skipped", event });
    return;
  }

  const payload = {
    request_id: event.request_id ?? null,
    conversation_id: event.conversation_id ?? null,
    event_type: event.event_type,
    actor: event.actor ?? "system",
    input: event.input ?? {},
    output: event.output ?? {},
    idempotency_key: event.idempotency_key ?? null,
    duration_ms: event.duration_ms ?? null,
  };

  const { error } = await client.from("audit_events").insert(payload);
  if (error) {
    log.warn({ msg: "audit_event_insert_failed", error: error.message, event: payload });
  }
}
