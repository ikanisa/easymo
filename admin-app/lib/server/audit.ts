"use server";

import { mockAuditEvents } from "@/lib/mock-data";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";

interface AuditContext {
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  diff?: Record<string, unknown>;
}

export async function recordAudit(context: AuditContext) {
  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    try {
      await adminClient.from("audit_log").insert({
        actor_id: context.actorId,
        action: context.action,
        target_table: context.targetTable,
        target_id: context.targetId,
        diff: context.diff ?? {},
      });
      return;
    } catch (error) {
      logStructured({
        event: "audit_insert_failed",
        target: "audit_log",
        status: "degraded",
        message: "Supabase audit insert failed, using in-memory fallback.",
        details: { error: error instanceof Error ? error.message : "unknown" },
      });
    }
  }

  mockAuditEvents.unshift({
    id: `audit-mock-${Date.now()}`,
    actor: context.actorId ?? "unknown",
    action: context.action,
    targetTable: context.targetTable,
    targetId: context.targetId,
    createdAt: new Date().toISOString(),
    summary: JSON.stringify(context.diff ?? {}),
  });
}
