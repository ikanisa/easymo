import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnyClient = SupabaseClient<any, any, any>;

interface AuditEntry {
  actorId?: string | null;
  saccoId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

export const writeAuditLog = async (supabase: AnyClient, entry: AuditEntry) => {
  const payload = {
    sacco_id: entry.saccoId ?? null,
    actor: entry.actorId ?? SYSTEM_ACTOR,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
  };

  const { error } = await supabase.schema("app").from("audit_logs").insert(payload);

  if (error) {
    console.error("audit log error", error);
  }
};
