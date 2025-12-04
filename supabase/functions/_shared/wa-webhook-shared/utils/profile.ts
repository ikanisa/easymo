import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { ensureProfile as ensureProfileRecord } from "../state/store.ts";

export type ProfileResult = {
  user_id: string;
  language: string;
} | null;

/**
 * Thin wrapper around the shared ensureProfile() helper so every webhook
 * surface reuses the same normalization and user-id mapping logic.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  from: string,
): Promise<ProfileResult> {
  const profile = await ensureProfileRecord(supabase, from);
  if (!profile) return null;

  return {
    user_id: profile.user_id,
    language: profile.locale ?? "en",
  };
}
