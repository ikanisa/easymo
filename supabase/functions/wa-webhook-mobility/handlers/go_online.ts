// Go Online feature for drivers
// Allows drivers to quickly share their location and start receiving ride requests

import type { RouterContext } from "../types.ts";
import { clearState, setState } from "../state/store.ts";
import { t } from "../i18n/translator.ts";
import { IDS } from "../wa/ids.ts";
import { sendText, sendButtons } from "../wa/client.ts";
import { sendButtonsMessage, homeOnly } from "../utils/reply.ts";
import { logStructuredEvent } from "../observe/log.ts";
import {
  getCachedLocation,
  saveLocationToCache,
} from "../locations/cache.ts";
import { getStoredVehicleType } from "./vehicle_plate.ts";
import { ensureDriverInsurance } from "./driver_insurance.ts";
import { timeAgo } from "../utils/text.ts";
import { insertTrip } from "../rpc/mobility.ts";
import { saveIntent } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";

/**
 * Start Go Online flow - prompt driver to share location
 */
export async function startGoOnline(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Check if driver has valid insurance certificate
  const hasInsurance = await ensureDriverInsurance(ctx, { type: "go_online" });
  if (!hasInsurance) {
    // ensureDriverInsurance will prompt for certificate upload
    return true;
  }

  // Check if driver has cached location
  const cached = await getCachedLocation(ctx.supabase, ctx.profileId);
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "go_online_prompt",
    data: {},
  });

  const buttons = [];
  
  if (cached && cached.isValid) {
    const timeAgoText = timeAgo(cached.cachedAt);
    buttons.push({
      id: IDS.USE_CACHED_LOCATION,
      title: `📍 ${timeAgoText} ago`,
    });
  }
  
  buttons.push({
    id: IDS.SHARE_NEW_LOCATION,
    title: t(ctx.locale, "mobility.go_online.share_new", {
      defaultValue: "Share Current Location",
    }),
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "mobility.go_online.prompt"),
    buttons,
  );

  return true;
}

/**
 * Handle when driver shares location to go online
 */
export async function handleGoOnlineLocation(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Save location to cache
    await saveLocationToCache(ctx.supabase, ctx.profileId, coords);

    // Get driver's vehicle type
    const vehicleType = await getStoredVehicleType(ctx.supabase, ctx.profileId);
    
    // CRITICAL FIX: Create a trip record so driver is visible in matching
    if (vehicleType) {
      try {
        // Create a driver trip for visibility to passengers
        await insertTrip(ctx.supabase, {
          userId: ctx.profileId,
          role: "driver",
          vehicleType,
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters: 10000, // 10km default radius
          pickupText: "Driver online",
        });
        
        await logStructuredEvent("DRIVER_TRIP_CREATED", {
          userId: ctx.profileId,
          vehicleType,
          lat: coords.lat,
          lng: coords.lng,
        });
      } catch (tripError) {
        console.error("Failed to create driver trip:", tripError);
        // Continue even if trip creation fails
      }

      // Also try to update driver_status table if it exists
      try {
        await ctx.supabase.rpc("rides_update_driver_location", {
          p_user_id: ctx.profileId,
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_is_online: true,
          p_metadata: { vehicle_type: vehicleType },
        });
      } catch (error) {
        // Ignore if function doesn't exist yet
        console.warn("rides_update_driver_location not available");
      }
    }

    await logStructuredEvent("DRIVER_WENT_ONLINE", {
      userId: ctx.profileId,
      lat: coords.lat,
      lng: coords.lng,
      vehicleType: vehicleType || "unknown",
    });

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "mobility.go_online.success"),
      homeOnly(),
    );

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    console.error("go_online.location_save_fail", error);
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}

/**
 * Handle using cached location to go online
 */
export async function handleGoOnlineUseCached(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const cached = await getCachedLocation(ctx.supabase, ctx.profileId);
    
    if (!cached || !cached.isValid) {
      await sendText(ctx.from, t(ctx.locale, "mobility.location_cache.expired"));
      return await startGoOnline(ctx);
    }

    const coords = { lat: cached.lat, lng: cached.lng };
    return await handleGoOnlineLocation(ctx, coords);
  } catch (error) {
    console.error("go_online.use_cached_fail", error);
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}

/**
 * Handle going offline
 */
export async function handleGoOffline(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Mark driver as offline in driver_status
    try {
      await ctx.supabase
        .from("rides_driver_status")
        .update({ is_online: false })
        .eq("user_id", ctx.profileId);
    } catch (error) {
      // Table might not exist, ignore
      console.warn("rides_driver_status update failed (table may not exist)");
    }

    await logStructuredEvent("DRIVER_WENT_OFFLINE", {
      userId: ctx.profileId,
    });

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "mobility.go_online.offline"),
      homeOnly(),
    );

    return true;
  } catch (error) {
    console.error("go_offline.fail", error);
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}
