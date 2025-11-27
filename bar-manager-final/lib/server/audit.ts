"use server";

import { logStructured } from "@/lib/server/logger";
import { enqueueReliabilityJob } from "@/lib/server/reliability-queue";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

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
        message: "Supabase audit insert failed; queuing for retry.",
        details: { error: error instanceof Error ? error.message : "unknown" },
      });
      await enqueueReliabilityJob("audit.persist", {
        actorId: context.actorId,
        action: context.action,
        targetTable: context.targetTable,
        targetId: context.targetId,
        diff: context.diff ?? {},
        error: error instanceof Error ? error.message : "unknown",
      });
      return;
    }
  }

  logStructured({
    event: "audit_persist_skipped",
    target: "audit_log",
    status: "degraded",
    message: "Supabase admin client unavailable; audit event queued for retry.",
    details: {
      action: context.action,
      targetTable: context.targetTable,
      targetId: context.targetId,
    },
  });
  await enqueueReliabilityJob("audit.persist", {
    actorId: context.actorId,
    action: context.action,
    targetTable: context.targetTable,
    targetId: context.targetId,
    diff: context.diff ?? {},
    error: "supabase_admin_unavailable",
  });
}
