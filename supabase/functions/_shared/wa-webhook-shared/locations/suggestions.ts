/**
 * Phase 3.3 & 3.4: Smart Location Suggestions
 * Time-based and usage-based location recommendations
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export type LocationSuggestion = {
  id: string;
  kind: string;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  reason: "time_based" | "most_used" | "recently_used";
};

/**
 * Get smart location suggestion based on time of day and usage patterns
 */
export async function getSmartLocationSuggestion(
  supabase: SupabaseClient,
  userId: string,
  options: {
    currentTime?: Date;
    includeReason?: boolean;
  } = {},
): Promise<LocationSuggestion | null> {
  const now = options.currentTime || new Date();
  const currentHour = now.getHours(); // 0-23
  const dayOfWeek = now.getDay(); // 0-6 (Sunday=0)

  // Morning (6-10 AM) on weekdays → suggest Work
  if (currentHour >= 6 && currentHour < 10 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    const { data } = await supabase
      .from("saved_locations")
      .select("id, kind, label, address, lat, lng")
      .eq("user_id", userId)
      .eq("kind", "work")
      .maybeSingle();
    
    if (data) {
      return { ...data, reason: "time_based" };
    }
  }

  // Evening (5-8 PM) → suggest Home
  if (currentHour >= 17 && currentHour < 20) {
    const { data } = await supabase
      .from("saved_locations")
      .select("id, kind, label, address, lat, lng")
      .eq("user_id", userId)
      .eq("kind", "home")
      .maybeSingle();
    
    if (data) {
      return { ...data, reason: "time_based" };
    }
  }

  // Otherwise, suggest most-used location
  const { data } = await supabase
    .from("saved_locations")
    .select("id, kind, label, address, lat, lng, usage_count, last_used_at")
    .eq("user_id", userId)
    .order("usage_count", { ascending: false, nullsFirst: false })
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    const reason = data.usage_count && data.usage_count > 0 ? "most_used" : "recently_used";
    return { ...data, reason };
  }

  return null;
}

/**
 * Get greeting message with smart suggestion
 */
export function getSuggestionMessage(
  suggestion: LocationSuggestion,
  locale = "en",
): string {
  const messages: Record<string, Record<string, string>> = {
    en: {
      time_based: `🌅 Good morning! Going to ${suggestion.label}?`,
      most_used: `📍 Frequent destination: ${suggestion.label}`,
      recently_used: `⭐ ${suggestion.label}`,
    },
    fr: {
      time_based: `🌅 Bonjour! Vous allez à ${suggestion.label}?`,
      most_used: `📍 Destination fréquente: ${suggestion.label}`,
      recently_used: `⭐ ${suggestion.label}`,
    },
    rw: {
      time_based: `🌅 Mwaramutse! Ujya ${suggestion.label}?`,
      most_used: `📍 Aho ujyaga kenshi: ${suggestion.label}`,
      recently_used: `⭐ ${suggestion.label}`,
    },
  };

  const localeMessages = messages[locale] || messages.en;
  return localeMessages[suggestion.reason] || localeMessages.recently_used;
}

/**
 * Increment usage counter when location is used
 */
export async function trackLocationUsage(
  supabase: SupabaseClient,
  locationId: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("increment_location_usage", {
      _location_id: locationId,
    });
    
    if (error) {
      console.warn("location_usage.track_fail", { locationId, error: error.message });
    }
  } catch (err) {
    console.warn("location_usage.track_error", err);
  }
}
