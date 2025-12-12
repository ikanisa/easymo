/**
 * Phase 3.1: Post-Trip Save Prompts
 * Prompt users to save trip destinations as saved locations
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { checkDuplicateLocation } from "./deduplication.ts";
import { getAddressOrCoords } from "./geocoding.ts";

export async function promptSaveDestination(
  supabase: SupabaseClient,
  userId: string,
  waId: string,
  tripData: {
    dropoffLat: number;
    dropoffLng: number;
    dropoffText?: string | null;
  },
): Promise<boolean> {
  // Check if already saved
  const dupCheck = await checkDuplicateLocation(
    supabase,
    userId,
    { lat: tripData.dropoffLat, lng: tripData.dropoffLng },
    100, // 100m radius
  );

  if (dupCheck.isDuplicate) {
    console.log("trip_completion.location_already_saved", {
      userId,
      existingLocation: dupCheck.nearbyLocations[0]?.label,
    });
    return false; // Already saved, no prompt needed
  }

  // Get human-readable address
  const address = tripData.dropoffText || 
    await getAddressOrCoords(tripData.dropoffLat, tripData.dropoffLng);

  // Import sendButtons dynamically to avoid circular dependencies
  const { sendButtonsDirect } = await import("../wa/client.ts");
  
  try {
    await sendButtonsDirect(
      waId,
      "en", // TODO: Get user's locale
      `🎯 **Save This Location?**\n\n📍 ${address}\n\nSave for faster bookings next time?`,
      [
        { id: `SAVE_LOC_HOME::${tripData.dropoffLat},${tripData.dropoffLng}`, title: "🏠 Save as Home" },
        { id: `SAVE_LOC_WORK::${tripData.dropoffLat},${tripData.dropoffLng}`, title: "💼 Save as Work" },
        { id: `SAVE_LOC_OTHER::${tripData.dropoffLat},${tripData.dropoffLng}`, title: "📍 Custom name" },
        { id: "SKIP_SAVE_LOC", title: "No thanks" },
      ],
    );

    console.log("trip_completion.save_prompt_sent", {
      userId,
      waId,
      address,
    });

    return true;
  } catch (error) {
    console.error("trip_completion.prompt_fail", error);
    return false;
  }
}

/**
 * Handle SAVE_LOC_* button clicks from post-trip prompts
 */
export function parseSaveLocationAction(
  buttonId: string,
): { kind: "home" | "work" | "other"; lat: number; lng: number } | null {
  if (!buttonId.startsWith("SAVE_LOC_")) return null;
  
  const parts = buttonId.split("::");
  if (parts.length !== 2) return null;

  const kind = parts[0].replace("SAVE_LOC_", "").toLowerCase();
  if (kind !== "home" && kind !== "work" && kind !== "other") return null;

  const coords = parts[1].split(",");
  if (coords.length !== 2) return null;

  const lat = Number(coords[0]);
  const lng = Number(coords[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { kind, lat, lng };
}
