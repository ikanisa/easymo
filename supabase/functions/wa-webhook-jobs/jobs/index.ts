// =====================================================
// JOB BOARD AI AGENT - WhatsApp Integration
// =====================================================
// Routes job board conversations to the AI agent
// Handles both job seekers and job posters
// Last updated: 2025-11-15
// =====================================================

import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { clearState, getState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { waChatLink } from "../../utils/links.ts";
import { detectCountryIso } from "../../utils/phone.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";
import { point as geoPoint } from "../../utils/geo.ts";
import { resolveUserCurrency } from "../../utils/currency.ts";
import { 
  getApplyButtonId, 
  extractJobIdFromApply,
  handleJobApplication,
  handleJobApplyMessage 
} from "./applications.ts";
import { handleSeekerOnboardingStep } from "./seeker-profile.ts";

// Helper function to send text messages
async function sendMessage(ctx: RouterContext, options: { text: string }): Promise<void> {
  await sendText(ctx.from, options.text);
}

interface JobConversation {
  conversationId: string;
  role: "job_seeker" | "job_poster" | "both";
  language: string;
  status: "active" | "completed";
}

type JobDuration = "one_day" | "short_term" | "long_term";

export type JobFindLocationState = {
  duration: JobDuration;
};

export type JobFindResultsState = {
  duration: JobDuration;
  jobs: NearbyJobSummary[];
  page: number;
};

export type JobPostState = {
  duration: JobDuration;
  coords?: { lat: number; lng: number };
  title?: string;
};

type NearbyJobSummary = {
  id: string;
  title: string;
  description: string;
  job_type: string;
  location: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string;
  currency: string | null;
  company_name?: string | null;
  contact_phone?: string | null;
  posted_by: string;
  created_at: string;
  distance_km?: number | null;
};

export type JobSavedPickerState = {
  source: "job_find" | "job_post";
  state: JobFindLocationState | JobPostState;
};

type JobCandidateSummary = {
  id: string;
  name: string | null;
  phone_number: string;
  skills?: string[] | null;
  preferred_locations?: string[] | null;
  experience_years?: number | null;
  last_active?: string | null;
};

export type JobCandidatesState = {
  jobId: string;
  jobTitle: string;
  candidates: JobCandidateSummary[];
  page: number;
};

const JOB_DURATION_ROWS = (locale: string) => [
  {
    id: "job_find_one_day",
    title: t(locale, "jobs.find.duration.oneDay"),
    description: t(locale, "jobs.find.duration.oneDay.desc"),
  },
  {
    id: "job_find_short_term",
    title: t(locale, "jobs.find.duration.short"),
    description: t(locale, "jobs.find.duration.short.desc"),
  },
  {
    id: "job_find_long_term",
    title: t(locale, "jobs.find.duration.long"),
    description: t(locale, "jobs.find.duration.long.desc"),
  },
];

const JOB_TYPE_FILTERS: Record<JobDuration, string[]> = {
  one_day: ["gig"],
  short_term: ["short_term", "gig"],
  long_term: ["full_time", "part_time"],
};

const JOB_TYPE_INSERT: Record<JobDuration, string> = {
  one_day: "gig",
  short_term: "short_term",
  long_term: "full_time",
};

const JOB_RESULT_PREFIX = "JOB::";
const JOB_SEEKER_PREFIX = "SEEKER::";
const JOB_RESULTS_PAGE_SIZE = 9;
const JOB_RESULTS_MORE_PREFIX = "JOB_MORE::";
const JOB_CANDIDATE_MORE_PREFIX = "SEEKER_MORE::";
const JOB_CANDIDATE_BUTTON_PREFIX = "job_candidates::";
const DEFAULT_JOB_CATEGORY = "general_services";
const MAX_RESULTS = JOB_RESULTS_PAGE_SIZE * 3;

function getDurationFromSelection(id: string): JobDuration | null {
  if (!id) return null;
  if (id.endsWith("one_day")) return "one_day";
  if (id.endsWith("short_term")) return "short_term";
  if (id.endsWith("long_term")) return "long_term";
  return null;
}

function durationLabel(locale: string, duration: JobDuration): string {
  const key = {
    "one_day": "jobs.find.duration.oneDay",
    "short_term": "jobs.find.duration.short",
    "long_term": "jobs.find.duration.long",
  }[duration];
  return key ? t(locale, key) : duration;
}

function formatPayRange(
  locale: string,
  job: Pick<
    NearbyJobSummary,
    "pay_min" | "pay_max" | "pay_type" | "currency"
  >,
): string {
  const currency = job.currency ?? "RWF";
  const min = job.pay_min ?? job.pay_max;
  const max = job.pay_max;
  const payTypeKey = job.pay_type
    ? `jobs.payType.${job.pay_type}`
    : "jobs.payType.negotiable";
  const period = t(locale, payTypeKey);

  if (min && max && String(min) !== String(max)) {
    return `${currency} ${min}-${max}/${period}`;
  }
  if (min) {
    return `${currency} ${min}/${period}`;
  }
  return `${currency} ${t(locale, "jobs.pay.negotiable")}`;
}

function formatDistance(locale: string, km?: number | null): string | null {
  if (!km && km !== 0) return null;
  return t(locale, "jobs.find.results.distance", {
    km: Number(km).toFixed(1),
  });
}

function favoriteToRow(favorite: UserFavorite) {
  return {
    id: favorite.id,
    title: `⭐ ${favorite.label}`,
    description: favorite.address ??
      `${favorite.lat.toFixed(4)}, ${favorite.lng.toFixed(4)}`,
  };
}

/**
 * Show job board main menu
 */
export async function showJobBoardMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_BOARD_MENU_SHOWN", {
    userId: ctx.profileId,
    language: ctx.locale,
  });

  const rows = [
    {
      id: IDS.JOB_FIND,
      title: t(ctx.locale, "jobs.menu.find.title"),
      description: t(ctx.locale, "jobs.menu.find.description"),
    },
    {
      id: "jobs_recommended",
      title: "⭐ Recommended for you",
      description: "Based on your profile and preferences",
    },
    {
      id: IDS.JOB_POST,
      title: t(ctx.locale, "jobs.menu.post.title"),
      description: t(ctx.locale, "jobs.menu.post.description"),
    },
    {
      id: IDS.JOB_MY_APPLICATIONS,
      title: t(ctx.locale, "jobs.menu.myApplications.title"),
      description: t(ctx.locale, "jobs.menu.myApplications.description"),
    },
    {
      id: IDS.JOB_MY_JOBS,
      title: t(ctx.locale, "jobs.menu.myJobs.title"),
      description: t(ctx.locale, "jobs.menu.myJobs.description"),
    },
  ];

  const header = t(ctx.locale, "jobs.menu.title");
  const greeting = t(ctx.locale, "jobs.menu.greeting");

  await sendListMessage(ctx, {
    title: header,
    body: greeting,
    sectionTitle: t(ctx.locale, "jobs.menu.section"),
    rows,
    buttonText: t(ctx.locale, "jobs.menu.button"),
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_board_menu",
    data: { timestamp: new Date().toISOString() },
  });

  return true;
}

/**
 * Start job search conversation (job seeker)
 */
export async function startJobSearch(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_find_type",
    data: {},
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "jobs.find.menu.title"),
      body: t(ctx.locale, "jobs.find.menu.body"),
      sectionTitle: t(ctx.locale, "jobs.find.menu.section"),
      rows: JOB_DURATION_ROWS(ctx.locale),
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🧭" },
  );
  return true;
}

/**
 * Start job posting conversation (job poster)
 */
export async function startJobPosting(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_post_type",
    data: {},
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "jobs.post.menu.title"),
      body: t(ctx.locale, "jobs.post.menu.body"),
      sectionTitle: t(ctx.locale, "jobs.find.menu.section"),
      rows: JOB_DURATION_ROWS(ctx.locale),
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🧱" },
  );
  return true;
}

export async function handleJobFindDurationSelection(
  ctx: RouterContext,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const duration = getDurationFromSelection(selectionId);
  if (!duration) return false;
  await promptLocationShare(
    ctx,
    { key: "job_find_location", data: { duration } satisfies JobFindLocationState },
    "jobs.find.prompt.location",
  );
  return true;
}

export async function handleJobPostDurationSelection(
  ctx: RouterContext,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const duration = getDurationFromSelection(selectionId);
  if (!duration) return false;
  await promptLocationShare(
    ctx,
    { key: "job_post_location", data: { duration } satisfies JobPostState },
    "jobs.post.prompt.location",
  );
  return true;
}

async function promptLocationShare(
  ctx: RouterContext,
  nextState: { key: string; data: JobFindLocationState | JobPostState },
  bodyKey: string,
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, nextState);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, bodyKey, {
      instructions: t(ctx.locale, "location.share.instructions"),
    }),
    buildButtons(
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
    ),
    { emoji: "📍" },
  );
}

export async function startJobSavedLocationPicker(
  ctx: RouterContext,
  mode: "find" | "post",
  snapshot: JobFindLocationState | JobPostState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorites = await listFavorites(ctx);
  const source: JobSavedPickerState["source"] = mode === "find"
    ? "job_find"
    : "job_post";

  await setState(ctx.supabase, ctx.profileId, {
    key: "location_saved_picker",
    data: {
      source,
      state: snapshot,
    } satisfies JobSavedPickerState,
  });

  const body = favorites.length
    ? t(ctx.locale, "location.saved.list.body", {
      context: t(ctx.locale, "location.context.pickup"),
    })
    : t(ctx.locale, "location.saved.list.empty");

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.list.title"),
      body,
      sectionTitle: t(ctx.locale, "location.saved.list.section"),
      rows: [
        ...favorites.map(favoriteToRow),
        ...buildSaveRows(ctx),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "location.saved.list.button"),
    },
    { emoji: "⭐" },
  );
  return true;
}

export async function handleJobSavedLocationSelection(
  ctx: RouterContext,
  picker: JobSavedPickerState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorite = await getFavoriteById(ctx, selectionId);
  if (!favorite) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.list.expired"),
      buildButtons(
        { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ),
    );
    return true;
  }

  if (picker.source === "job_find") {
    return await handleJobFindLocation(
      ctx,
      picker.state as JobFindLocationState,
      { lat: favorite.lat, lng: favorite.lng },
    );
  }
  return await handleJobPostLocation(
    ctx,
    picker.state as JobPostState,
    { lat: favorite.lat, lng: favorite.lng },
  );
}

export async function handleJobFindLocation(
  ctx: RouterContext,
  state: JobFindLocationState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data, error } = await ctx.supabase.rpc("get_nearby_jobs", {
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_job_types: JOB_TYPE_FILTERS[state.duration],
    p_limit: MAX_RESULTS,
  });

  if (error) {
    console.error("jobs.find.nearby_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.error.fetch_failed"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  const jobs = data ?? [];
  if (!jobs.length) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "job_find_type",
      data: {},
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.find.results.empty"),
      buildButtons(
        { id: IDS.JOB_FIND, title: t(ctx.locale, "jobs.find.buttons.restart") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ),
      { emoji: "ℹ️" },
    );
    return true;
  }

  const nextState: JobFindResultsState = {
    duration: state.duration,
    jobs,
    page: 0,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_find_results",
    data: nextState,
  });
  await sendJobResultsList(ctx, nextState);
  return true;
}

async function sendJobResultsList(
  ctx: RouterContext,
  state: JobFindResultsState,
): Promise<void> {
  if (!ctx.profileId) return;
  const start = state.page * JOB_RESULTS_PAGE_SIZE;
  const slice = state.jobs.slice(start, start + JOB_RESULTS_PAGE_SIZE);
  const from = start + 1;
  const to = start + slice.length;
  if (!slice.length) {
    const resetState = { ...state, page: 0 };
    await setState(ctx.supabase, ctx.profileId, {
      key: "job_find_results",
      data: resetState,
    });
    return await sendJobResultsList(ctx, resetState);
  }

  const rows = slice.map((job) => ({
    id: `${JOB_RESULT_PREFIX}${job.id}`,
    title: `${job.title}`,
    description: [
      formatPayRange(ctx.locale, job),
      job.location,
      formatDistance(ctx.locale, job.distance_km ?? null),
    ].filter(Boolean).join(" • "),
  }));

  if (to < state.jobs.length) {
    rows.push({
      id: `${JOB_RESULTS_MORE_PREFIX}${state.page + 1}`,
      title: t(ctx.locale, "jobs.find.results.more.title"),
      description: t(ctx.locale, "jobs.find.results.more.description"),
    });
  }

  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "jobs.find.results.title", {
        duration: durationLabel(ctx.locale, state.duration),
      }),
      body: t(ctx.locale, "jobs.find.results.body", {
        from,
        to,
        total: state.jobs.length,
      }),
      sectionTitle: t(ctx.locale, "jobs.find.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "💼" },
  );
}

export async function handleJobResultsSelection(
  ctx: RouterContext,
  state: JobFindResultsState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Check for apply button click
  const applyJobId = extractJobIdFromApply(selectionId);
  if (applyJobId) {
    return await handleJobApplication(ctx, applyJobId);
  }

  if (selectionId.startsWith(JOB_RESULT_PREFIX)) {
    const jobId = selectionId.slice(JOB_RESULT_PREFIX.length);
    const job = state.jobs.find((entry) => entry.id === jobId);
    if (!job) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "jobs.find.results.expired"),
        buildButtons(
          { id: IDS.JOB_RESULTS_BACK, title: t(ctx.locale, "jobs.find.buttons.backList") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    await sendJobResultDetail(ctx, job);
    return true;
  }

  if (selectionId.startsWith(JOB_RESULTS_MORE_PREFIX)) {
    const page = Number(selectionId.slice(JOB_RESULTS_MORE_PREFIX.length));
    const maxPage = Math.floor((state.jobs.length - 1) / JOB_RESULTS_PAGE_SIZE);
    const nextPage = Number.isFinite(page)
      ? Math.min(Math.max(page, 0), maxPage)
      : 0;
    const nextState = { ...state, page: nextPage };
    await setState(ctx.supabase, ctx.profileId, {
      key: "job_find_results",
      data: nextState,
    });
    await sendJobResultsList(ctx, nextState);
    return true;
  }

  return false;
}

export async function replayJobResults(
  ctx: RouterContext,
  state: JobFindResultsState,
): Promise<boolean> {
  await sendJobResultsList(ctx, state);
  return true;
}

async function sendJobResultDetail(
  ctx: RouterContext,
  job: NearbyJobSummary,
): Promise<void> {
  const contact = job.contact_phone ?? job.posted_by;
  const chatLink = contact ? waChatLink(contact) : null;
  const distance = formatDistance(ctx.locale, job.distance_km ?? null);
  const summary = t(ctx.locale, "jobs.find.job.body", {
    title: job.title,
    location: job.location,
    pay: formatPayRange(ctx.locale, job),
    type: t(ctx.locale, `jobs.type.${job.job_type}`),
    distance: distance ? `\n📍 ${distance}` : "",
    description: summarize(job.description ?? ""),
  });
  const contactLine = contact
    ? t(ctx.locale, "jobs.find.job.contact", {
      whatsapp: contact,
      link: chatLink ?? "",
    })
    : t(ctx.locale, "jobs.find.job.contact_missing");

  await sendButtonsMessage(
    ctx,
    `${summary}\n\n${contactLine}`,
    buildButtons(
      { id: getApplyButtonId(job.id), title: "📝 Apply Now" },
      { id: IDS.JOB_RESULTS_BACK, title: t(ctx.locale, "jobs.find.buttons.backList") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
    ),
    { emoji: "💼" },
  );
}

export async function handleJobPostLocation(
  ctx: RouterContext,
  state: JobPostState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const nextState: JobPostState = { ...state, coords };
  await setState(ctx.supabase, ctx.profileId, {
    key: "job_post_details",
    data: nextState,
  });
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.post.prompt.details"),
    buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    { emoji: "📝" },
  );
  return true;
}

export async function handleJobPostDetails(
  ctx: RouterContext,
  state: JobPostState,
  messageText: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const coords = state.coords;
  if (!coords) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.post.error.location_missing"),
      buildButtons({ id: IDS.JOB_POST, title: t(ctx.locale, "jobs.post.buttons.restart") }),
    );
    return true;
  }
  const trimmed = messageText.trim();
  if (!trimmed) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.post.error.details_missing"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  const [titleLine, ...restLines] = trimmed.split(/\n+/);
  const title = titleLine.trim().slice(0, 80);
  const description = restLines.join("\n").trim() || title;

  if (title.length < 3) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.post.error.title_short"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  const currencyPref = resolveUserCurrency(ctx.from);
  const countryCode = detectCountryIso(ctx.from)?.toUpperCase();
  const locationLabel = `Pin @ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  const jobType = JOB_TYPE_INSERT[state.duration] ?? "gig";

  const payload: Record<string, unknown> = {
    posted_by: ctx.from,
    poster_name: null,
    title,
    description,
    job_type: jobType,
    category: DEFAULT_JOB_CATEGORY,
    location: locationLabel,
    pay_type: "negotiable",
    currency: currencyPref.code,
    duration: state.duration,
    contact_phone: ctx.from,
    contact_whatsapp: ctx.from,
    geog: geoPoint(coords.lng, coords.lat),
    country_code: countryCode,
    metadata: { source: "whatsapp" },
  };

  const { data, error } = await ctx.supabase
    .from("job_listings")
    .insert(payload)
    .select("id, title")
    .single();

  if (error) {
    console.error("jobs.post.save_error", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.post.error.save_failed"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  await clearState(ctx.supabase, ctx.profileId);

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.post.success", {
      title,
      location: locationLabel,
      duration: durationLabel(ctx.locale, state.duration),
    }),
    buildButtons(
      {
        id: `${JOB_CANDIDATE_BUTTON_PREFIX}${data?.id}`,
        title: t(ctx.locale, "jobs.post.buttons.viewCandidates"),
      },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
    ),
    { emoji: "✅" },
  );

  return true;
}

export async function showJobCandidates(
  ctx: RouterContext,
  jobId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: job } = await ctx.supabase
    .from("job_listings")
    .select("id, title, country_code")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.candidates.missing_job"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  let query = ctx.supabase
    .from("job_seekers")
    .select("id, name, phone_number, skills, preferred_locations, experience_years, last_active, country_code")
    .order("last_active", { ascending: false })
    .limit(MAX_RESULTS);

  if (job.country_code) {
    query = query.eq("country_code", job.country_code);
  }

  const { data, error } = await query;
  if (error) {
    console.error("jobs.candidates.fetch_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.error.fetch_failed"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    );
    return true;
  }

  const candidates = (data ?? []) as JobCandidateSummary[];
  if (!candidates.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.candidates.empty"),
      buildButtons(
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ),
      { emoji: "ℹ️" },
    );
    return true;
  }

  const nextState: JobCandidatesState = {
    jobId,
    jobTitle: job.title,
    candidates,
    page: 0,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_candidates_results",
    data: nextState,
  });
  await sendJobCandidatesList(ctx, nextState);
  return true;
}

async function sendJobCandidatesList(
  ctx: RouterContext,
  state: JobCandidatesState,
): Promise<void> {
  if (!ctx.profileId) return;
  const start = state.page * JOB_RESULTS_PAGE_SIZE;
  const slice = state.candidates.slice(start, start + JOB_RESULTS_PAGE_SIZE);
  const from = start + 1;
  const to = start + slice.length;

  if (!slice.length) {
    const resetState = { ...state, page: 0 };
    await setState(ctx.supabase, ctx.profileId, {
      key: "job_candidates_results",
      data: resetState,
    });
    return await sendJobCandidatesList(ctx, resetState);
  }

  const rows = slice.map((candidate) => ({
    id: `${JOB_SEEKER_PREFIX}${candidate.id}`,
    title: candidate.name || t(ctx.locale, "jobs.candidates.unknown"),
    description: [
      candidate.skills?.slice(0, 2).join(", "),
      candidate.preferred_locations?.[0],
    ].filter(Boolean).join(" • ") || t(ctx.locale, "jobs.candidates.generic_desc"),
  }));

  if (to < state.candidates.length) {
    rows.push({
      id: `${JOB_CANDIDATE_MORE_PREFIX}${state.page + 1}`,
      title: t(ctx.locale, "jobs.candidates.more.title"),
      description: t(ctx.locale, "jobs.candidates.more.description"),
    });
  }

  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "jobs.candidates.title", { title: state.jobTitle }),
      body: t(ctx.locale, "jobs.candidates.body", {
        from,
        to,
        total: state.candidates.length,
      }),
      sectionTitle: t(ctx.locale, "jobs.candidates.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "👥" },
  );
}

export async function handleJobCandidatesSelection(
  ctx: RouterContext,
  state: JobCandidatesState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (selectionId.startsWith(JOB_SEEKER_PREFIX)) {
    const seekerId = selectionId.slice(JOB_SEEKER_PREFIX.length);
    const candidate = state.candidates.find((item) => item.id === seekerId);
    if (!candidate) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "jobs.candidates.expired"),
        buildButtons(
          { id: IDS.JOB_CANDIDATES_BACK, title: t(ctx.locale, "jobs.candidates.buttons.backList") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
      );
      return true;
    }
    await sendCandidateDetail(ctx, candidate);
    return true;
  }

  if (selectionId.startsWith(JOB_CANDIDATE_MORE_PREFIX)) {
    const page = Number(selectionId.slice(JOB_CANDIDATE_MORE_PREFIX.length));
    const maxPage = Math.floor((state.candidates.length - 1) / JOB_RESULTS_PAGE_SIZE);
    const nextPage = Number.isFinite(page)
      ? Math.min(Math.max(page, 0), maxPage)
      : 0;
    const nextState = { ...state, page: nextPage };
    await setState(ctx.supabase, ctx.profileId, {
      key: "job_candidates_results",
      data: nextState,
    });
    await sendJobCandidatesList(ctx, nextState);
    return true;
  }

  return false;
}

export async function replayJobCandidates(
  ctx: RouterContext,
  state: JobCandidatesState,
): Promise<boolean> {
  await sendJobCandidatesList(ctx, state);
  return true;
}

async function sendCandidateDetail(
  ctx: RouterContext,
  candidate: JobCandidateSummary,
): Promise<void> {
  const chatLink = waChatLink(candidate.phone_number);
  const body = t(ctx.locale, "jobs.candidates.detail", {
    name: candidate.name || t(ctx.locale, "jobs.candidates.unknown"),
    phone: candidate.phone_number,
    skills: candidate.skills?.slice(0, 3).join(", ") ||
      t(ctx.locale, "jobs.candidates.generic_desc"),
    experience: candidate.experience_years ?? t(ctx.locale, "jobs.candidates.experience.unknown"),
  });
  await sendButtonsMessage(
    ctx,
    `${body}\n\n${t(ctx.locale, "jobs.candidates.contact", { link: chatLink })}`,
    buildButtons(
      { id: IDS.JOB_CANDIDATES_BACK, title: t(ctx.locale, "jobs.candidates.buttons.backList") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
    ),
    { emoji: "👥" },
  );
}

function summarize(text: string, limit = 420): string {
  const normalized = text.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.substring(0, limit - 1).trim()}…`;
}

/**
 * Handle ongoing job board conversation
 * Routes user messages to the job-board-ai-agent edge function
 */
export async function handleJobBoardText(
  ctx: RouterContext,
  messageText: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const state = await getState(ctx.supabase, ctx.profileId);
  if (!state || state.key !== "job_conversation") {
    return false;
  }

  const conversationData = (state.data || {}) as Partial<JobConversation> & { startedAt?: string };

  await logStructuredEvent("JOB_AGENT_MESSAGE", {
    userId: ctx.profileId,
    role: conversationData.role || "unknown",
    messageLength: messageText.length,
  });

  try {
    // Call job-board-ai-agent edge function
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/job-board-ai-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-correlation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          phone_number: ctx.from,
          message: messageText,
          language: ctx.locale,
          role: conversationData.role,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Job agent error:", errorText);
      
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.error.agent_failed"),
      });
      
      return true;
    }

    const data = await response.json();

    // Send agent's response
    if (data.message) {
      await sendMessage(ctx, {
        text: data.message,
      });
    }

    // Log tool calls if any
    if (data.tool_calls && data.tool_calls.length > 0) {
      await logStructuredEvent("JOB_AGENT_TOOLS", {
        userId: ctx.profileId,
        toolCount: data.tool_calls.length,
        tools: data.tool_calls.map((tc: any) => tc.name),
      });
    }

    return true;
  } catch (error: any) {
    console.error("Job board agent error:", error);
    
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.something_wrong"),
    });
    
    return true;
  }
}

/**
 * Show user's job applications
 */
export async function showMyApplications(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_APPLICATIONS_VIEW", {
    userId: ctx.profileId,
  });

  try {
    // First, get the job_seeker record using phone number
    const { data: seeker, error: seekerError } = await ctx.supabase
      .from("job_seekers")
      .select("id")
      .eq("phone_number", ctx.from)
      .maybeSingle();

    if (seekerError) throw seekerError;

    if (!seeker) {
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.applications.no_profile"),
      });
      return true;
    }

    // Query job_applications table using the seeker's id
    const { data: applications, error } = await ctx.supabase
      .from("job_applications")
      .select(`
        id,
        status,
        created_at,
        job_listings (
          id,
          title,
          location,
          pay_min,
          pay_max,
          pay_type,
          currency,
          job_type
        )
      `)
      .eq("seeker_id", seeker.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!applications || applications.length === 0) {
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.applications.none"),
      });
      return true;
    }

    // Format applications list
    let message = t(ctx.locale, "jobs.applications.header") + "\n\n";

    applications.forEach((app: any, index: number) => {
      const job = app.job_listings;
      const payInfo = job.pay_min && job.pay_max
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}/${job.pay_type}`
        : t(ctx.locale, "jobs.pay.negotiable");

      message += `${index + 1}. *${job.title}*\n`;
      message += `   📍 ${job.location}\n`;
      message += `   💰 ${payInfo}\n`;
      message += `   📋 ${t(ctx.locale, `jobs.type.${job.job_type}`)}\n`;
      message += `   Status: ${t(ctx.locale, `jobs.status.${app.status}`)}\n\n`;
    });

    message += t(ctx.locale, "jobs.applications.footer");

    await sendMessage(ctx, { text: message });

    return true;
  } catch (error: any) {
    console.error("Error fetching applications:", error);
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.fetch_failed"),
    });
    return true;
  }
}

/**
 * Show user's posted jobs
 */
export async function startMyJobsMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "jobs.myJobs.menu.title"),
      body: t(ctx.locale, "jobs.myJobs.menu.body"),
      sectionTitle: t(ctx.locale, "jobs.myJobs.menu.section"),
      buttonText: t(ctx.locale, "common.buttons.open"),
      rows: [
        {
          id: "job_my_add",
          title: t(ctx.locale, "jobs.myJobs.menu.add.title"),
          description: t(ctx.locale, "jobs.myJobs.menu.add.description"),
        },
        {
          id: "job_my_view",
          title: t(ctx.locale, "jobs.myJobs.menu.view.title"),
          description: t(ctx.locale, "jobs.myJobs.menu.view.description"),
        },
        {
          id: "job_my_ai",
          title: t(ctx.locale, "jobs.myJobs.menu.ai.title"),
          description: t(ctx.locale, "jobs.myJobs.menu.ai.description"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
    },
    { emoji: "💼" },
  );

  return true;
}

export async function listMyJobs(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_MY_JOBS_VIEW", {
    userId: ctx.profileId,
  });

  try {
    // Query job_listings table using phone number (posted_by is text field with phone)
    const { data: jobs, error } = await ctx.supabase
      .from("job_listings")
      .select(`
        id,
        title,
        location,
        status,
        job_type,
        pay_min,
        pay_max,
        pay_type,
        currency,
        created_at
      `)
      .eq("posted_by", ctx.from)  // Use phone number, not profileId
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "jobs.myJobs.none"),
        buildButtons(
          { id: "job_my_add", title: t(ctx.locale, "jobs.myJobs.menu.add.short") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ),
        { emoji: "💼" },
      );
      return true;
    }

    // Get application counts for each job
    const jobIds = jobs.map((j: any) => j.id);
    const { data: appCounts } = await ctx.supabase
      .from("job_applications")
      .select("job_id")
      .in("job_id", jobIds);

    // Count applications per job
    const countsByJob = (appCounts || []).reduce((acc: any, app: any) => {
      acc[app.job_id] = (acc[app.job_id] || 0) + 1;
      return acc;
    }, {});

    // Format jobs list
    let message = t(ctx.locale, "jobs.myJobs.header") + "\n\n";

    jobs.forEach((job: any, index: number) => {
      const payInfo = job.pay_min && job.pay_max
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}/${job.pay_type}`
        : t(ctx.locale, "jobs.pay.negotiable");

      const applicants = countsByJob[job.id] || 0;

      message += `${index + 1}. *${job.title}*\n`;
      message += `   📍 ${job.location}\n`;
      message += `   💰 ${payInfo}\n`;
      message += `   📋 ${t(ctx.locale, `jobs.type.${job.job_type}`)} | ${t(ctx.locale, `jobs.status.${job.status}`)}\n`;
      message += `   👥 ${applicants} applicant${applicants !== 1 ? "s" : ""}\n\n`;
    });

    message += t(ctx.locale, "jobs.myJobs.footer");

    await sendMessage(ctx, { text: message });

    return true;
  } catch (error: any) {
    console.error("Error fetching my jobs:", error);
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.fetch_failed"),
    });
    return true;
  }
}

/**
 * Main text message router
 * Handles state-based routing for text messages
 */
export async function handleJobTextMessage(
  ctx: RouterContext,
  messageText: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const state = await getState(ctx.supabase, ctx.profileId);

  // Handle job application cover message
  if (state?.key === "job_apply_message") {
    return await handleJobApplyMessage(ctx, state.data, messageText);
  }

  // Handle seeker onboarding steps
  if (state?.key === "seeker_onboarding") {
    return await handleSeekerOnboardingStep(ctx, state.data, messageText);
  }

  // Handle job posting details
  if (state?.key === "job_post_details") {
    return await handleJobPostDetails(ctx, state.data, messageText);
  }

  // Not handled by job board
  return false;
}
