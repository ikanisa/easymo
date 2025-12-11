import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { listMyJobs } from "./list.ts";

export async function confirmDeleteJob(
  ctx: RouterContext,
  jobId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendButtonsMessage(
    ctx,
    "⚠️ *Delete Job Posting*\n\nAre you sure you want to delete this job posting? This action cannot be undone.",
    [
      { id: `CONFIRM_DELETE_JOB::${jobId}`, title: "🗑️ Yes, Delete" },
      { id: `JOB::${jobId}`, title: "← Cancel" },
    ],
  );

  return true;
}

export async function handleDeleteJob(
  ctx: RouterContext,
  jobId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("job_listings")
    .delete()
    .eq("id", jobId)
    .eq("posted_by", ctx.profileId);

  if (error) {
    console.error("Failed to delete job:", error);
    await sendTextMessage(
      ctx,
      "⚠️ Failed to delete job posting. Please try again.",
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    "✅ Job posting deleted successfully.",
  );

  // Return to list
  return listMyJobs(ctx);
}
