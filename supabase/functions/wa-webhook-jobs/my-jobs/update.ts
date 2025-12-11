import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { handleJobSelection } from "./list.ts";

export async function startEditJob(
  ctx: RouterContext,
  jobId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendListMessage(
    ctx,
    {
      title: "✏️ Edit Job Posting",
      body: "What would you like to update?",
      sectionTitle: "Fields",
      buttonText: "Select Field",
      rows: [
        {
          id: `EDIT_JOB_TITLE::${jobId}`,
          title: "Title",
          description: "Change job title",
        },
        {
          id: `EDIT_JOB_DESC::${jobId}`,
          title: "Description",
          description: "Update description",
        },
        {
          id: `EDIT_JOB_LOC::${jobId}`,
          title: "Location",
          description: "Update job location",
        },
        {
          id: `EDIT_JOB_REQ::${jobId}`,
          title: "Requirements",
          description: "Update job requirements",
        },
        {
          id: `BACK_JOB::${jobId}`,
          title: "← Back",
          description: "Return to job details",
        },
      ],
    },
    { emoji: "✏️" },
  );

  return true;
}

export async function promptEditJobField(
  ctx: RouterContext,
  jobId: string,
  field: "title" | "description" | "location" | "requirements",
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const stateKey = `job_edit_${field}`;
  await setState(ctx.supabase, ctx.profileId, {
    key: stateKey,
    data: { jobId },
  });

  const prompts = {
    title: "Enter the new title for this job:",
    description: "Enter the new description for this job:",
    location: "Enter the new location for this job:",
    requirements: "Enter the new requirements for this job:",
  };

  await sendButtonsMessage(
    ctx,
    `✏️ *Edit ${field.charAt(0).toUpperCase() + field.slice(1)}*\n\n${prompts[field]}`,
    [{ id: `BACK_JOB::${jobId}`, title: "← Cancel" }],
  );

  return true;
}

export async function handleUpdateJobField(
  ctx: RouterContext,
  jobId: string,
  field: "title" | "description" | "location" | "requirements",
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmedValue = value.trim();

  // Input validation
  if (trimmedValue.length < 2) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} must be at least 2 characters long. Please try again.`,
    );
    return true;
  }

  // Field-specific length limits
  const maxLengths: Record<string, number> = {
    title: 150,
    description: 1000,
    location: 200,
    requirements: 1000,
  };

  if (trimmedValue.length > maxLengths[field]) {
    await sendTextMessage(
      ctx,
      `⚠️ ${field.charAt(0).toUpperCase() + field.slice(1)} is too long. Please keep it under ${maxLengths[field]} characters.`,
    );
    return true;
  }

  const updates: Record<string, unknown> = { [field]: trimmedValue, updated_at: new Date().toISOString() };

  const { error } = await ctx.supabase
    .from("job_listings")
    .update(updates)
    .eq("id", jobId)
    .eq("posted_by", ctx.profileId);

  if (error) {
    console.error(`Failed to update job ${field}:`, error);
    await sendTextMessage(
      ctx,
      `⚠️ Failed to update job ${field}. Please try again.`,
    );
    return true;
  }

  await sendTextMessage(
    ctx,
    `✅ Job ${field} updated successfully!`,
  );

  // Return to job details
  return handleJobSelection(ctx, jobId);
}
