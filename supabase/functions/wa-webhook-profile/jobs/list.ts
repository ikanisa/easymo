import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export async function listMyJobs(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: jobs, error } = await ctx.supabase
    .from("job_listings")
    .select("id, title, location, salary_min, salary_max, status")
    .eq("posted_by", ctx.profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch jobs:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your job postings. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }

  if (!jobs || jobs.length === 0) {
    await sendButtonsMessage(
      ctx,
      "💼 *You don't have any job postings yet.*\n\nTap below to chat with our Jobs AI Agent who will help you create a job posting through a simple conversation.",
      [
        { id: IDS.JOBS_AGENT, title: "💬 Chat with Jobs Agent" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = jobs.map((j) => {
    const salaryRange =
      j.salary_min && j.salary_max
        ? `${j.salary_min.toLocaleString()}-${j.salary_max.toLocaleString()} RWF`
        : j.salary_min
        ? `From ${j.salary_min.toLocaleString()} RWF`
        : "Salary negotiable";

    return {
      id: `JOB::${j.id}`,
      title: j.title,
      description: `${j.location || "Remote"} • ${salaryRange}`,
    };
  });

  rows.push(
    {
      id: IDS.JOBS_AGENT,
      title: "💬 Add via AI Agent",
      description: "Chat with AI to post new job",
    },
    {
      id: IDS.BACK_PROFILE,
      title: "← Back to Profile",
      description: "Return to profile menu",
    },
  );

  await sendListMessage(
    ctx,
    {
      title: "💼 My Job Postings",
      body: `You have ${jobs.length} active job posting${jobs.length === 1 ? "" : "s"}`,
      sectionTitle: "Jobs",
      buttonText: "View",
      rows,
    },
    { emoji: "💼" },
  );

  return true;
}

export async function handleJobSelection(
  ctx: RouterContext,
  jobId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: job, error } = await ctx.supabase
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .eq("posted_by", ctx.profileId)
    .single();

  if (error || !job) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Job posting not found or you don't have permission to view it.",
      [{ id: IDS.MY_JOBS, title: "← Back to Jobs" }],
    );
    return true;
  }

  const salaryInfo =
    job.salary_min && job.salary_max
      ? `💰 ${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()} RWF`
      : job.salary_min
      ? `💰 From ${job.salary_min.toLocaleString()} RWF`
      : "💰 Salary negotiable";

  const details = [
    `*${job.title}*`,
    job.location ? `📍 ${job.location}` : null,
    salaryInfo,
    job.description ? `\n${job.description}` : null,
    job.requirements ? `\n*Requirements:*\n${job.requirements}` : null,
    job.status ? `\nStatus: ${job.status}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendListMessage(
    ctx,
    {
      title: "💼 Job Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `EDIT_JOB::${jobId}`,
          title: "✏️ Edit",
          description: "Update job posting",
        },
        {
          id: `DELETE_JOB::${jobId}`,
          title: "🗑️ Delete",
          description: "Remove this job posting",
        },
        {
          id: IDS.MY_JOBS,
          title: "← Back",
          description: "Return to jobs list",
        },
      ],
    },
    { emoji: "💼" },
  );

  return true;
}
