import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { listMyJobs } from "./list.ts";

export async function startCreateJob(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_create_title",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    "💼 *Post New Job*\n\nWhat is the job title?",
    [{ id: IDS.BACK_PROFILE, title: "← Cancel" }],
  );

  return true;
}

export async function handleCreateJobTitle(
  ctx: RouterContext,
  title: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedTitle = title.trim();

  // Basic validation - minimum length
  if (trimmedTitle.length < 3) {
    await sendTextMessage(
      ctx,
      "⚠️ Job title must be at least 3 characters long. Please try again.",
    );
    return true;
  }

  // Maximum length validation
  if (trimmedTitle.length > 150) {
    await sendTextMessage(
      ctx,
      "⚠️ Job title must be less than 150 characters. Please try again.",
    );
    return true;
  }

  // Create the job
  const { error } = await ctx.supabase.from("job_listings").insert({
    posted_by: ctx.profileId,
    title: trimmedTitle,
    description: "New job posting", // Default description
    status: "active",
  });

  if (error) {
    console.error("Failed to create job:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to create job posting. Please try again.",
      [{ id: IDS.MY_JOBS, title: "← Back" }],
    );
    return true;
  }

  // Clear state
  await clearState(ctx.supabase, ctx.profileId);

  // Confirm and show list
  await sendTextMessage(
    ctx,
    `✅ Job *${title}* posted successfully!`,
  );

  // Return to list
  return listMyJobs(ctx);
}
