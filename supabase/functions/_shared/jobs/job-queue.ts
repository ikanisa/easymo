/**
 * Job Queue Management
 * 
 * Handles job queue operations including:
 * - Getting next job (with FOR UPDATE SKIP LOCKED)
 * - Updating job status
 * - Error handling and retry logic
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../observability.ts";
import type { Job } from "../types/buy-sell.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

/**
 * Get next job from queue using FOR UPDATE SKIP LOCKED
 * This ensures atomic operation and prevents double-processing
 */
export async function getNextJob(
  supabase: SupabaseClient,
  jobType?: "sourcing" | "broadcast" | "notification",
  correlationId?: string
): Promise<Job | null> {
  try {
    // Use RPC function for atomic operation with FOR UPDATE SKIP LOCKED
    const { data, error } = await supabase.rpc("get_next_job", {
      p_job_type: jobType || null,
    });

    if (error) {
      logStructuredEvent("GET_NEXT_JOB_ERROR", {
        error: error.message,
        jobType,
        correlationId,
      }, "error");
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const job = data[0] as Job;

    logStructuredEvent("JOB_ACQUIRED", {
      jobId: job.id,
      jobType: job.job_type,
      userId: job.user_id,
      correlationId,
    });

    return job;
  } catch (error) {
    logStructuredEvent("GET_NEXT_JOB_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      jobType,
      correlationId,
    }, "error");
    return null;
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: "processing" | "completed" | "failed",
  errorMessage?: string,
  correlationId?: string
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "processing") {
      updateData.started_at = new Date().toISOString();
    } else if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    } else if (status === "failed") {
      updateData.completed_at = new Date().toISOString();
      updateData.error_message = errorMessage || "Unknown error";
    }

    const { error } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", jobId);

    if (error) {
      logStructuredEvent("UPDATE_JOB_STATUS_ERROR", {
        jobId,
        status,
        error: error.message,
        correlationId,
      }, "error");
      return false;
    }

    logStructuredEvent("JOB_STATUS_UPDATED", {
      jobId,
      status,
      correlationId,
    });

    return true;
  } catch (error) {
    logStructuredEvent("UPDATE_JOB_STATUS_EXCEPTION", {
      jobId,
      status,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return false;
  }
}

/**
 * Mark job as processing (called when worker picks up job)
 */
export async function markJobProcessing(
  supabase: SupabaseClient,
  jobId: string,
  correlationId?: string
): Promise<boolean> {
  return updateJobStatus(supabase, jobId, "processing", undefined, correlationId);
}

/**
 * Mark job as completed
 */
export async function markJobCompleted(
  supabase: SupabaseClient,
  jobId: string,
  correlationId?: string
): Promise<boolean> {
  return updateJobStatus(supabase, jobId, "completed", undefined, correlationId);
}

/**
 * Mark job as failed (with retry logic)
 */
export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
  correlationId?: string
): Promise<boolean> {
  // Check if job should be retried
  const { data: job } = await supabase
    .from("jobs")
    .select("retry_count, priority")
    .eq("id", jobId)
    .single();

  if (job && (job.retry_count as number) < MAX_RETRIES) {
    // Reschedule job for retry
    await supabase
      .from("jobs")
      .update({
        status: "pending",
        priority: ((job.priority as number) || 0) + 1, // Increase priority for retry
        retry_count: (job.retry_count as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    logStructuredEvent("JOB_SCHEDULED_FOR_RETRY", {
      jobId,
      retryCount: (job.retry_count as number) + 1,
      maxRetries: MAX_RETRIES,
      correlationId,
    });

    return true;
  }

  // Max retries reached, mark as failed
  return updateJobStatus(supabase, jobId, "failed", errorMessage, correlationId);
}

/**
 * Create a new job in the queue
 */
export async function createJob(
  supabase: SupabaseClient,
  job: {
    user_id: string;
    job_type: "sourcing" | "broadcast" | "notification";
    payload_json: Record<string, unknown>;
    priority?: number;
  },
  correlationId?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        user_id: job.user_id,
        job_type: job.job_type,
        payload_json: job.payload_json,
        status: "pending",
        priority: job.priority || 0,
        retry_count: 0,
      })
      .select("id")
      .single();

    if (error) {
      logStructuredEvent("CREATE_JOB_ERROR", {
        error: error.message,
        jobType: job.job_type,
        correlationId,
      }, "error");
      return null;
    }

    logStructuredEvent("JOB_CREATED", {
      jobId: data.id,
      jobType: job.job_type,
      userId: job.user_id,
      correlationId,
    });

    return data.id;
  } catch (error) {
    logStructuredEvent("CREATE_JOB_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      jobType: job.job_type,
      correlationId,
    }, "error");
    return null;
  }
}

