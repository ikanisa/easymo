/**
 * Dead Letter Queue (DLQ) Manager
 * 
 * Handles storage and retrieval of failed webhook payloads
 * for later reprocessing.
 */

import type { SupabaseClient } from "./wa-webhook-shared/deps.ts";

export interface DLQEntry {
  id?: string;
  phone_number?: string;
  service: string;
  correlation_id?: string;
  request_id?: string;
  payload: Record<string, unknown>;
  error_message: string;
  error_type: string;
  status_code?: number;
  retry_count?: number;
  status?: "pending" | "processing" | "reprocessed" | "failed" | "discarded";
}

export interface DLQStats {
  total: number;
  pending: number;
  processing: number;
  reprocessed: number;
  failed: number;
  discarded: number;
}

/**
 * Store a failed webhook in the DLQ
 */
export async function storeDLQEntry(
  supabase: SupabaseClient,
  entry: DLQEntry,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("webhook_dlq")
      .insert({
        phone_number: entry.phone_number,
        service: entry.service,
        correlation_id: entry.correlation_id,
        request_id: entry.request_id,
        payload: entry.payload,
        error_message: entry.error_message,
        error_type: entry.error_type,
        status_code: entry.status_code,
        retry_count: entry.retry_count ?? 0,
        status: "pending",
        next_retry_at: calculateNextRetry(entry.retry_count ?? 0),
      })
      .select("id")
      .single();

    if (error) {
      console.error("DLQ_STORE_FAILED", { error: error.message });
      return { success: false, error: error.message };
    }

    console.log("DLQ_STORED", { id: data.id, service: entry.service });
    return { success: true, id: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DLQ_STORE_ERROR", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Get pending DLQ entries ready for retry
 */
export async function getPendingDLQEntries(
  supabase: SupabaseClient,
  limit = 10,
): Promise<DLQEntry[]> {
  try {
    const { data, error } = await supabase
      .from("webhook_dlq")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("DLQ_FETCH_FAILED", { error: error.message });
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.error("DLQ_FETCH_ERROR", { error });
    return [];
  }
}

/**
 * Mark a DLQ entry as processing
 */
export async function markDLQProcessing(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webhook_dlq")
      .update({ status: "processing" })
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Mark a DLQ entry as reprocessed
 */
export async function markDLQReprocessed(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webhook_dlq")
      .update({
        status: "reprocessed",
        reprocessed_at: new Date().toISOString(),
      })
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Mark a DLQ entry as failed (after max retries)
 */
export async function markDLQFailed(
  supabase: SupabaseClient,
  id: string,
  errorMessage: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webhook_dlq")
      .update({
        status: "failed",
        error_message: errorMessage,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Increment retry count and update next retry time
 */
export async function incrementDLQRetry(
  supabase: SupabaseClient,
  id: string,
  retryCount: number,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webhook_dlq")
      .update({
        retry_count: retryCount + 1,
        last_retry_at: new Date().toISOString(),
        next_retry_at: calculateNextRetry(retryCount + 1),
        status: "pending",
      })
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Get DLQ statistics
 */
export async function getDLQStats(
  supabase: SupabaseClient,
): Promise<DLQStats> {
  try {
    const { data, error } = await supabase
      .from("webhook_dlq")
      .select("status");

    if (error || !data) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        reprocessed: 0,
        failed: 0,
        discarded: 0,
      };
    }

    const stats = data.reduce(
      (acc, row) => {
        acc.total++;
        if (row.status) acc[row.status as keyof DLQStats]++;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        processing: 0,
        reprocessed: 0,
        failed: 0,
        discarded: 0,
      } as DLQStats,
    );

    return stats;
  } catch {
    return {
      total: 0,
      pending: 0,
      processing: 0,
      reprocessed: 0,
      failed: 0,
      discarded: 0,
    };
  }
}

/**
 * Calculate next retry time with exponential backoff
 * Max 5 retries: 5min, 15min, 1hr, 4hr, 12hr
 */
function calculateNextRetry(retryCount: number): string {
  const delays = [
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    4 * 60 * 60 * 1000, // 4 hours
    12 * 60 * 60 * 1000, // 12 hours
  ];

  const delay = delays[Math.min(retryCount, delays.length - 1)];
  return new Date(Date.now() + delay).toISOString();
}
