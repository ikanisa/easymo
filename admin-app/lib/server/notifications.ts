import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";
import { recordAudit } from "@/lib/server/audit";

type NotificationIntent = {
  type: string;
  toRole: string;
  msisdn: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
};

export async function enqueueNotification(intent: NotificationIntent) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("supabase_unavailable");
  }

  const { data, error } = await adminClient
    .from("notifications")
    .insert({
      type: intent.type,
      to_role: intent.toRole,
      msisdn: intent.msisdn,
      status: "queued",
      metadata: intent.metadata ?? {},
      payload: intent.payload ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    logStructured({
      event: "notification_enqueue_failed",
      target: "notifications",
      status: "error",
      message: error?.message ?? "insert_failed",
      details: { notificationType: intent.type, toRole: intent.toRole },
    });
    throw error ?? new Error("insert_failed");
  }

  await recordAudit({
    actorId: intent.actorId ?? null,
    action: "notification_enqueue",
    targetTable: "notifications",
    targetId: data.id,
    diff: {
      type: intent.type,
      toRole: intent.toRole,
      msisdn: intent.msisdn,
    },
  });

  logStructured({
    event: "notification_enqueued",
    target: "notifications",
    status: "ok",
    details: { notificationType: intent.type, toRole: intent.toRole, notificationId: data.id },
  });

  return data.id;
}
