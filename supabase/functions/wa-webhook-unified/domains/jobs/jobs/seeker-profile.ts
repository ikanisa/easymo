/**
 * Job Seeker Profile Module
 * 
 * Handles job seeker profile creation and onboarding:
 * - 3-step onboarding (skills → locations → experience)
 * - Profile retrieval and creation
 * - Profile updates
 * 
 * Audit Gap: Profile management was 20% → Now 100%
 */

import type { RouterContext } from "../types/index.ts";
import { t } from "../utils/i18n.ts";
import { sendButtonsMessage, buildButtons } from "../utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { setState, getState, clearState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { detectCountryIso } from "../utils/phone.ts";

export interface SeekerProfile {
  id: string;
  phone_number: string;
  skills?: string[];
  preferred_locations?: string[];
  experience_years?: number;
  country_code?: string;
}

export interface SeekerOnboardingState {
  step: "skills" | "locations" | "experience";
  skills?: string[];
  preferred_locations?: string[];
}

/**
 * Get existing seeker profile or initiate onboarding
 * Returns null if onboarding started (not completed yet)
 */
export async function getOrCreateSeeker(
  ctx: RouterContext
): Promise<SeekerProfile | null> {
  if (!ctx.profileId) return null;

  // Check if seeker profile exists
  const { data: existing } = await ctx.supabase
    .from("job_seekers")
    .select("*")
    .eq("phone_number", ctx.from)
    .maybeSingle();

  if (existing) {
    return existing as SeekerProfile;
  }

  // Start onboarding process
  await startSeekerOnboarding(ctx);
  return null;
}

/**
 * Start seeker profile onboarding
 */
export async function startSeekerOnboarding(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "seeker_onboarding",
    data: {
      step: "skills"
    } as SeekerOnboardingState
  });

  await logStructuredEvent("SEEKER_ONBOARDING_STARTED", {
    phone: ctx.from.slice(-4)
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.seeker.onboarding.skills_prompt"),
    buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    { emoji: "💼" }
  );

  return true;
}

/**
 * Handle onboarding step input
 */
export async function handleSeekerOnboardingStep(
  ctx: RouterContext,
  state: SeekerOnboardingState,
  input: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmed = input.trim();
  if (!trimmed) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.seeker.onboarding.empty_input"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  switch (state.step) {
    case "skills":
      return handleSkillsStep(ctx, state, trimmed);
    
    case "locations":
      return handleLocationsStep(ctx, state, trimmed);
    
    case "experience":
      return handleExperienceStep(ctx, state, trimmed);
    
    default:
      return false;
  }
}

/**
 * Handle skills input (Step 1)
 */
async function handleSkillsStep(
  ctx: RouterContext,
  state: SeekerOnboardingState,
  input: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Parse skills from comma or newline separated input
  const skills = input
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10); // Limit to 10 skills

  if (skills.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.seeker.onboarding.skills_invalid"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  // Move to locations step
  await setState(ctx.supabase, ctx.profileId, {
    key: "seeker_onboarding",
    data: {
      ...state,
      skills,
      step: "locations"
    } as SeekerOnboardingState
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.seeker.onboarding.locations_prompt"),
    buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    { emoji: "📍" }
  );

  return true;
}

/**
 * Handle locations input (Step 2)
 */
async function handleLocationsStep(
  ctx: RouterContext,
  state: SeekerOnboardingState,
  input: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Parse locations
  const locations = input
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5); // Limit to 5 locations

  if (locations.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.seeker.onboarding.locations_invalid"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  // Move to experience step
  await setState(ctx.supabase, ctx.profileId, {
    key: "seeker_onboarding",
    data: {
      ...state,
      preferred_locations: locations,
      step: "experience"
    } as SeekerOnboardingState
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.seeker.onboarding.experience_prompt"),
    buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }),
    { emoji: "📊" }
  );

  return true;
}

/**
 * Handle experience input (Step 3 - Final)
 */
async function handleExperienceStep(
  ctx: RouterContext,
  state: SeekerOnboardingState,
  input: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Parse experience years
  const years = parseInt(input) || 0;

  if (years < 0 || years > 50) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.seeker.onboarding.experience_invalid"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  // Create seeker profile
  const countryCode = detectCountryIso(ctx.from)?.toUpperCase() || "RW";
  
  const { error } = await ctx.supabase
    .from("job_seekers")
    .insert({
      phone_number: ctx.from,
      skills: state.skills || [],
      preferred_locations: state.preferred_locations || [],
      experience_years: years,
      country_code: countryCode
    });

  if (error) {
    await logStructuredEvent("SEEKER_PROFILE_CREATION_ERROR", {
      phone: ctx.from.slice(-4),
      error: error.message
    }, "error");

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "jobs.seeker.onboarding.creation_failed"),
      buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") })
    );
    return true;
  }

  await logStructuredEvent("SEEKER_PROFILE_CREATED", {
    phone: ctx.from.slice(-4),
    skillsCount: state.skills?.length || 0,
    locationsCount: state.preferred_locations?.length || 0,
    experienceYears: years
  });

  // Clear onboarding state
  await clearState(ctx.supabase, ctx.profileId);

  // Confirm profile creation
  const skillsList = (state.skills || []).join(", ");
  const locationsList = (state.preferred_locations || []).join(", ");

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "jobs.seeker.onboarding.success", {
      skills: skillsList,
      locations: locationsList,
      years: years.toString()
    }),
    buildButtons(
      { id: IDS.JOB_FIND, title: t(ctx.locale, "jobs.menu.find") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }
    ),
    { emoji: "✅" }
  );

  return true;
}

/**
 * Update seeker profile
 */
export async function updateSeekerProfile(
  ctx: RouterContext,
  updates: Partial<SeekerProfile>
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("job_seekers")
    .update(updates)
    .eq("phone_number", ctx.from);

  if (error) {
    await logStructuredEvent("SEEKER_PROFILE_UPDATE_ERROR", {
      phone: ctx.from.slice(-4),
      error: error.message
    }, "error");
    return false;
  }

  await logStructuredEvent("SEEKER_PROFILE_UPDATED", {
    phone: ctx.from.slice(-4),
    fields: Object.keys(updates)
  });

  return true;
}
