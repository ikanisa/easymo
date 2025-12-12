/**
 * State Store
 * Simple state storage and retrieval
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import type { UserState, StateUpdate } from "../types/context.ts";
import { TIMEOUTS } from "../config/constants.ts";
import { logStructuredEvent } from "../observability.ts";

// ============================================================================
// STATE OPERATIONS
// ============================================================================

/**
 * Get user state
 */
export async function getState<TData = unknown>(
  supabase: SupabaseClient,
  userId: string
): Promise<UserState<TData> | null> {
  try {
    const { data, error } = await supabase
      .from("user_state")
      .select("key, data, created_at, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await clearState(supabase, userId);
      return null;
    }

    return {
      key: data.key,
      data: data.data as TData,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    logStructuredEvent("STATE_GET_ERROR", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return null;
  }
}

/**
 * Set user state
 */
export async function setState<TData = unknown>(
  supabase: SupabaseClient,
  userId: string,
  update: StateUpdate<TData>
): Promise<boolean> {
  try {
    const ttl = update.ttlSeconds ?? TIMEOUTS.STATE_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const { error } = await supabase
      .from("user_state")
      .upsert({
        user_id: userId,
        key: update.key,
        data: update.data,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      logStructuredEvent("STATE_SET_ERROR", {
        userId,
        key: update.key,
        error: error.message,
      }, "error");
      return false;
    }

    return true;
  } catch (error) {
    logStructuredEvent("STATE_SET_ERROR", {
      userId,
      key: update.key,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Clear user state
 */
export async function clearState(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_state")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logStructuredEvent("STATE_CLEAR_ERROR", {
        userId,
        error: error.message,
      }, "error");
      return false;
    }

    return true;
  } catch (error) {
    logStructuredEvent("STATE_CLEAR_ERROR", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Update state data without changing key
 */
export async function updateStateData<TData = unknown>(
  supabase: SupabaseClient,
  userId: string,
  dataUpdater: (currentData: TData) => TData
): Promise<boolean> {
  const currentState = await getState<TData>(supabase, userId);
  if (!currentState) return false;

  const newData = dataUpdater(currentState.data);
  return await setState(supabase, userId, {
    key: currentState.key,
    data: newData,
  });
}

// ============================================================================
// PROFILE OPERATIONS
// ============================================================================

/**
 * Ensure user profile exists
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  waId: string
): Promise<{ user_id: string; language: string } | null> {
  try {
    // Try to find existing profile
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id, language")
      .eq("whatsapp_e164", waId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Create new profile
    const userId = crypto.randomUUID();
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        whatsapp_e164: waId,
        language: "en",
        created_at: new Date().toISOString(),
      })
      .select("user_id, language")
      .single();

    if (error) {
      logStructuredEvent("PROFILE_CREATE_ERROR", {
        waId,
        error: error.message,
      }, "error");
      return null;
    }

    logStructuredEvent("PROFILE_CREATED", { userId, waId });
    return created;
  } catch (error) {
    logStructuredEvent("PROFILE_ENSURE_ERROR", {
      waId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return null;
  }
}
