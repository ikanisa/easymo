// Chat state management utilities

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import type { ChatState } from "./types.ts";

export async function getState(
  supabase: SupabaseClient,
  profileId: string
): Promise<ChatState | null> {
  const { data, error } = await supabase
    .from("chat_states")
    .select("state")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data?.state ?? null;
}

export async function setState(
  supabase: SupabaseClient,
  profileId: string,
  state: ChatState
): Promise<void> {
  const { error } = await supabase
    .from("chat_states")
    .upsert({
      profile_id: profileId,
      state,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function clearState(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("chat_states")
    .delete()
    .eq("profile_id", profileId);

  if (error) throw error;
}
