import { supabase } from "../../config.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { normalizeWaId } from "./auth.ts";

export type AdminAuditParams = {
  adminWaId: string;
  action: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function recordAdminAudit(
  params: AdminAuditParams,
): Promise<void> {
  const normalized = normalizeWaId(params.adminWaId);
  const payload = {
    admin_user_id: null as string | null,
    actor_wa: normalized,
    action: params.action,
    target: params.targetId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
  };
  const { error } = await supabase.from("admin_audit_log").insert(payload);
  if (error) {
    await logStructuredEvent("ADMIN_ACTION", {
      status: "error",
      action: params.action,
      target: params.targetId ?? null,
      wa_id: normalized,
      error: error.message,
    });
    throw error;
  }
  await logStructuredEvent("ADMIN_ACTION", {
    status: "ok",
    action: params.action,
    target: params.targetId ?? null,
    wa_id: `***${normalized.slice(-4)}`,
  });
}

export async function logAdminDenied(
  waId: string,
  action: string,
  reason: string,
): Promise<void> {
  const normalized = normalizeWaId(waId);
  await logStructuredEvent("ADMIN_DENIED", {
    wa_id: `***${normalized.slice(-4)}`,
    action,
    reason,
  });
}
