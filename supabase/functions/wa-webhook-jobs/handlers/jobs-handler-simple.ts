// Simplified jobs handler for initial deployment
// Full handler will be migrated in next phase

import type { RouterContext } from "@easymo/wa-webhook-shared";
import { sendText } from "@easymo/wa-webhook-shared";
import { setState } from "@easymo/wa-webhook-shared";
import { logStructuredEvent } from "@easymo/wa-webhook-observability";

export async function handleJobsMessage(
  ctx: RouterContext,
  message: string
): Promise<void> {
  await logStructuredEvent("JOBS_MESSAGE_HANDLED", {
    userId: ctx.profileId,
    messageLength: message.length,
  });

  // For now, acknowledge the message
  await sendText(
    ctx.phone,
    "👋 Welcome to EasyMO Jobs!\n\n" +
    "We're setting up the job board service. You'll be able to:\n" +
    "🔍 Search for jobs\n" +
    "📝 Post job opportunities\n" +
    "📋 Track your applications\n\n" +
    "Coming soon!"
  );

  await setState(ctx.supabase, ctx.profileId, {
    flow: "jobs",
    step: "welcome_sent",
    data: { timestamp: new Date().toISOString() },
  });
}

export async function showJobsMenu(ctx: RouterContext): Promise<void> {
  await logStructuredEvent("JOBS_MENU_SHOWN", {
    userId: ctx.profileId,
  });

  await sendText(
    ctx.phone,
    "💼 EasyMO Jobs Board\n\n" +
    "Choose an option:\n" +
    "1️⃣ Find Jobs\n" +
    "2️⃣ Post a Job\n" +
    "3️⃣ My Applications\n" +
    "4️⃣ My Posted Jobs\n\n" +
    "Reply with a number to continue."
  );
}
