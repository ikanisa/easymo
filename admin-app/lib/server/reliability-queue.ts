"use server";

import { logStructured } from "@/lib/server/logger";
import { emitMetric } from "@/lib/server/metrics";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type ReliabilityMetadata = Record<string, unknown> | undefined;

type EnqueueOptions = {
  metadata?: ReliabilityMetadata;
  availableAt?: Date;
};

export async function enqueueReliabilityJob(
  jobType: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<boolean> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    logStructured({
      event: "reliability.enqueue.skipped",
      target: "reliability_jobs",
      status: "degraded",
      message: "Supabase admin client unavailable; unable to persist reliability job.",
      details: { jobType },
    });
    emitMetric("reliability.queue.missing_client", 1, { job_type: jobType });
    return false;
  }

  try {
    const { error } = await adminClient
      .from("reliability_jobs")
      .insert({
        job_type: jobType,
        payload,
        metadata: options.metadata ?? {},
        available_at: options.availableAt?.toISOString() ?? new Date().toISOString(),
      });

    if (error) {
      logStructured({
        event: "reliability.enqueue.failed",
        target: "reliability_jobs",
        status: "error",
        message: error.message,
        details: { jobType },
      });
      emitMetric("reliability.queue.error", 1, { job_type: jobType });
      return false;
    }

    emitMetric("reliability.queue.enqueued", 1, { job_type: jobType });
    return true;
  } catch (error) {
    logStructured({
      event: "reliability.enqueue.exception",
      target: "reliability_jobs",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      details: { jobType },
    });
    emitMetric("reliability.queue.exception", 1, { job_type: jobType });
    return false;
  }
}
