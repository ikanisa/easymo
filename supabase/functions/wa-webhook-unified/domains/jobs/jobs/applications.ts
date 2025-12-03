/**
 * Job Applications Module
 * 
 * Handles job application flow:
 * - Apply to jobs
 * - Track application status
 * - Prevent duplicates
 * - Employer notifications
 * 
 * Audit Gap: Job application flow was missing (30% → 100%)
 */

import type { RouterContext } from "../types/index.ts";
import { t } from "../utils/i18n.ts";
import { sendButtonsMessage, buildButtons } from "../utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { setState, getState, clearState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { getOrCreateSeeker } from "./seeker-profile.ts";

export interface JobApplyState {
  jobId: string;
  seekerId: string;
  jobTitle: string;
}

const APPLY_BUTTON_PREFIX = "APPLY::";

/**
 * Generate apply button ID for a job
 */
export function getApplyButtonId(jobId: string): string {
  return `${APPLY_BUTTON_PREFIX}${jobId}`;
}

/**
 * Extract job ID from apply button selection
 */
export function extractJobIdFromApply(selectionId: string): string | null {
  if (!selectionId?.startsWith(APPLY_BUTTON_PREFIX)) return null;
  return selectionId.slice(APPLY_BUTTON_PREFIX.length);
}

/**
 * Check if user has already applied to this job
 */
async function checkExistingApplication(
  ctx: RouterContext,
  seekerId: string,
  jobId: string
): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("job_applications")
    .select("id")
    .eq("seeker_id", seekerId)
    .eq("job_id", jobId)
    .maybeSingle();
  
  return !!data;
}

/**
 * Check if user is trying to apply to their own job
 */
async function isSelfApplication(
  ctx: RouterContext,
  jobId: string
): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("job_listings")
    .select("posted_by")
    .eq("id", jobId)
    .maybeSingle();
  
  return data?.posted_by === ctx.from;
}

/**
 * Initiate job application process
 * Called when user taps "Apply Now" button
 */
export async function handleJobApplication(
  ctx: RouterContext,
  jobId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_APPLICATION_INITIATED", {
    phone: ctx.from.slice(-4),
    jobId
  });

  // Check if user is trying to apply to their own job
  if (await isSelfApplication(ctx, jobId)) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.apply.error.self_application"),
      buildButtons(
        { id: IDS.JOB_RESULTS_BACK, title: t(ctx.locale, "jobs.find.buttons.backList") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
      )
    );
    return true;
  }

  // Get job details
  const { data: job } = await ctx.supabase
    .from("job_listings")
    .select("id, title, posted_by, status")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.status !== "active") {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.apply.error.job_not_found"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  // Get or create seeker profile
  const seeker = await getOrCreateSeeker(ctx);
  if (!seeker) {
    // getOrCreateSeeker handles the onboarding flow
    return true;
  }

  // Check for existing application
  const alreadyApplied = await checkExistingApplication(ctx, seeker.id, jobId);
  if (alreadyApplied) {
    await logStructuredEvent("JOB_APPLICATION_DUPLICATE", {
      phone: ctx.from.slice(-4),
      jobId
    });

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.apply.error.already_applied"),
      buildButtons(
        { id: IDS.JOB_RESULTS_BACK, title: t(ctx.locale, "jobs.find.buttons.backList") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
      )
    );
    return true;
  }

  // Prompt for cover message
  await setState(ctx.supabase, ctx.profileId, {
    key: "job_apply_message",
    data: {
      jobId,
      seekerId: seeker.id,
      jobTitle: job.title
    } as JobApplyState
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.apply.prompt.cover_message", { title: job.title }),
    buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    { emoji: "📝" }
  );

  return true;
}

/**
 * Handle cover message submission
 */
export async function handleJobApplyMessage(
  ctx: RouterContext,
  state: JobApplyState,
  message: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmed = message.trim();
  if (!trimmed) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.apply.error.message_required"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  // Submit application
  const { error } = await ctx.supabase
    .from("job_applications")
    .insert({
      job_id: state.jobId,
      seeker_id: state.seekerId,
      cover_message: trimmed,
      status: "pending"
    });

  if (error) {
    await logStructuredEvent("JOB_APPLICATION_ERROR", {
      phone: ctx.from.slice(-4),
      jobId: state.jobId,
      error: error.message
    }, "error");

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.apply.error.submission_failed"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  await logStructuredEvent("JOB_APPLICATION_SUBMITTED", {
    phone: ctx.from.slice(-4),
    jobId: state.jobId
  });

  // Notify employer
  await notifyEmployer(ctx, state.jobId, state.jobTitle, trimmed);

  // Clear state
  await clearState(ctx.supabase, ctx.profileId);

  // Confirm to applicant
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.apply.success", { title: state.jobTitle }),
    buildButtons(
      { id: IDS.JOB_FIND, title: t(ctx.locale, "jobs.menu.find") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
    ),
    { emoji: "✅" }
  );

  return true;
}

/**
 * Notify employer of new application
 */
async function notifyEmployer(
  ctx: RouterContext,
  jobId: string,
  jobTitle: string,
  coverMessage: string
): Promise<void> {
  try {
    // Get job poster's phone
    const { data: job } = await ctx.supabase
      .from("job_listings")
      .select("posted_by, contact_phone")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) return;

    const employerPhone = job.contact_phone || job.posted_by;
    
    const message = t(ctx.locale, "jobs.apply.employer_notification", {
      title: jobTitle,
      phone: ctx.from,
      message: coverMessage
    });

    await sendText(employerPhone, message);

    await logStructuredEvent("EMPLOYER_NOTIFIED", {
      jobId,
      employerPhone: employerPhone.slice(-4),
      applicantPhone: ctx.from.slice(-4)
    });
  } catch (error) {
    await logStructuredEvent("EMPLOYER_NOTIFICATION_FAILED", {
      jobId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");
  }
}

/**
 * Show user's application history
 */
export async function showMyApplications(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get seeker profile
  const seeker = await getOrCreateSeeker(ctx);
  if (!seeker) return true;

  // Get applications with job details
  const { data: applications } = await ctx.supabase
    .from("job_applications")
    .select(`
      id,
      status,
      applied_at,
      job_listings:job_id (
        id,
        title,
        location,
        job_type,
        company_name
      )
    `)
    .eq("seeker_id", seeker.id)
    .order("applied_at", { ascending: false })
    .limit(10);

  if (!applications || applications.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.applications.empty"),
      buildButtons(
        { id: IDS.JOB_FIND, title: t(ctx.locale, "jobs.menu.find") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
      )
    );
    return true;
  }

  // Format applications list
  const appList = applications.map((app: any, idx: number) => {
    const job = app.job_listings;
    const status = app.status === "pending" ? "⏳" : app.status === "reviewed" ? "👁️" : app.status === "accepted" ? "✅" : "❌";
    return `${idx + 1}. ${status} ${job.title}\n   ${job.location || "Location not specified"}`;
  }).join("\n\n");

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.applications.list", { applications: appList }),
    buildButtons(
      { id: IDS.JOB_FIND, title: t(ctx.locale, "jobs.menu.find") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
    ),
    { emoji: "📋" }
  );

  return true;
}
