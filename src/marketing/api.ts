import { supabase } from "@/integrations/supabase/client";
import type { QPayload, SendQueueRow, SendLogRow, QueueStatus } from "./types";

/** ============ QUEUE ============ */

export async function enqueueMany(
  recipients: string[],
  payload: QPayload,
  opts?: { campaign_id?: number | null; scheduleAt?: string | null }
) {
  const rows = recipients.map((msisdn) => ({
    msisdn_e164: msisdn,
    payload,
    campaign_id: opts?.campaign_id ?? null,
    next_attempt_at: opts?.scheduleAt ?? new Date().toISOString(),
    status: "PENDING" as QueueStatus,
  }));

  const { error } = await (supabase as any).from("send_queue").insert(rows);
  if (error) throw error;
  return true;
}

export async function listQueue(params?: {
  status?: QueueStatus | "ALL";
  limit?: number;
}) {
  const q = (supabase as any)
    .from("send_queue")
    .select("id,campaign_id,msisdn_e164,payload,attempt,next_attempt_at,status")
    .order("id", { ascending: false })
    .limit(params?.limit ?? 100);

  if (params?.status && params.status !== "ALL") q.eq("status", params.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SendQueueRow[];
}

export async function updateQueueStatus(
  id: number,
  patch: Partial<Pick<SendQueueRow, "status" | "next_attempt_at" | "attempt">>
) {
  const { error } = await (supabase as any).from("send_queue").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteQueueRow(id: number) {
  const { error } = await (supabase as any).from("send_queue").delete().eq("id", id);
  if (error) throw error;
}

/** ============ LOGS ============ */

export async function listLogs(params?: {
  msisdn?: string;
  limit?: number;
}) {
  let q = (supabase as any)
    .from("send_logs")
    .select(
      "id,queue_id,campaign_id,msisdn_e164,sent_at,provider_msg_id,delivery_status,error"
    )
    .order("id", { ascending: false })
    .limit(params?.limit ?? 200);

  if (params?.msisdn) q = q.eq("msisdn_e164", params.msisdn);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SendLogRow[];
}

/** ============ DISPATCHER ============ */

/**
 * Run the dispatcher once (manual kick).
 * Store the function URL in Settings UI (localStorage).
 * Example: https://<ref>.supabase.co/functions/v1/campaign-dispatch
 */
export async function runDispatcherOnce(functionUrl: string) {
  const res = await fetch(functionUrl, { method: "GET" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
