/**
 * Generic Queue Processor
 * Handles queue-based OCR job processing for any domain
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface QueueJob {
  id: string;
  status: "queued" | "processing" | "retry" | "succeeded" | "failed";
  attempts: number;
  [key: string]: any; // Domain-specific fields
}

export interface QueueProcessorConfig {
  tableName: string;
  maxAttempts: number;
  scanLimit: number;
}

export interface ProcessResult {
  id: string;
  status: "succeeded" | "failed" | "retry" | "skipped";
  error?: string;
  [key: string]: any; // Domain-specific results
}

/**
 * Fetch queued jobs from database
 */
export async function fetchQueuedJobs(
  client: SupabaseClient,
  config: QueueProcessorConfig,
): Promise<QueueJob[]> {
  const { data, error } = await client
    .from(config.tableName)
    .select("*")
    .in("status", ["queued", "retry"])
    .order("created_at", { ascending: true })
    .limit(config.scanLimit);

  if (error) {
    await logStructuredEvent("QUEUE_FETCH_ERROR", {
      table: config.tableName,
      error: error.message,
    }, "error");
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

  return (data ?? []) as QueueJob[];
}

/**
 * Claim a job for processing (atomic update)
 */
export async function claimJob(
  client: SupabaseClient,
  config: QueueProcessorConfig,
  jobId: string,
  currentAttempts: number,
): Promise<boolean> {
  const now = new Date().toISOString();
  
  const { data, error } = await client
    .from(config.tableName)
    .update({
      status: "processing",
      attempts: currentAttempts + 1,
      last_attempt_at: now,
    })
    .eq("id", jobId)
    .in("status", ["queued", "retry"])
    .select("id")
    .maybeSingle();

  if (error) {
    await logStructuredEvent("QUEUE_CLAIM_ERROR", {
      table: config.tableName,
      jobId,
      error: error.message,
    }, "error");
    return false;
  }

  return !!data;
}

/**
 * Update job status after processing
 */
export async function updateJobStatus(
  client: SupabaseClient,
  config: QueueProcessorConfig,
  jobId: string,
  status: "succeeded" | "failed" | "retry",
  updates: Record<string, any> = {},
): Promise<void> {
  const now = new Date().toISOString();
  
  const updateData: Record<string, any> = {
    status,
    ...updates,
  };

  // Only set updated_at if the table has this column
  // (insurance_media_queue doesn't have it, but ocr_jobs does)
  if (config.tableName !== "insurance_media_queue") {
    updateData.updated_at = now;
  }

  if (status === "succeeded" || status === "failed") {
    updateData.processed_at = now;
  }

  const { error } = await client
    .from(config.tableName)
    .update(updateData)
    .eq("id", jobId);

  if (error) {
    await logStructuredEvent("QUEUE_UPDATE_ERROR", {
      table: config.tableName,
      jobId,
      status,
      error: error.message,
    }, "error");
    throw new Error(`Failed to update job: ${error.message}`);
  }
}

/**
 * Count remaining queued jobs
 */
export async function countQueuedJobs(
  client: SupabaseClient,
  config: QueueProcessorConfig,
): Promise<number> {
  const { count, error } = await client
    .from(config.tableName)
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "retry"]);

  if (error) {
    await logStructuredEvent("QUEUE_COUNT_ERROR", {
      table: config.tableName,
      error: error.message,
    }, "warn");
    return -1;
  }

  return count ?? 0;
}

/**
 * Determine next status based on attempts
 */
export function determineNextStatus(
  attempts: number,
  maxAttempts: number,
): "retry" | "failed" {
  return attempts < maxAttempts ? "retry" : "failed";
}
