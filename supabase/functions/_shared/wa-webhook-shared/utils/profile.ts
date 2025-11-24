import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProfileResult = {
  user_id: string;
  language: string;
} | null;

/**
 * Ensures a profile exists for the given WhatsApp number.
 * If no profile exists, creates one automatically.
 * This fixes the critical issue where workflows fail silently due to missing profiles.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  from: string,
): Promise<ProfileResult> {
  // Try to find existing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, language")
    .or(`phone_number.eq.${from},wa_id.eq.${from}`)
    .maybeSingle();

  if (profile) {
    return profile;
  }

  // No profile found - create one automatically
  console.log(JSON.stringify({
    event: "AUTO_CREATING_PROFILE",
    from,
    timestamp: new Date().toISOString(),
  }));

  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert({
      wa_id: from,
      phone_number: from,
      language: "en",
      created_at: new Date().toISOString(),
    })
    .select("user_id, language")
    .single();

  if (error) {
    console.error(JSON.stringify({
      event: "PROFILE_CREATION_FAILED",
      from,
      error: error.message,
      code: error.code,
    }));
    return null;
  }

  console.log(JSON.stringify({
    event: "PROFILE_CREATED",
    from,
    user_id: newProfile.user_id,
  }));

  return newProfile;
}
