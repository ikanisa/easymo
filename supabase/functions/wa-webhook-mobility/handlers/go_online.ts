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
import { ensureVehiclePlate } from "./vehicle_plate.ts";
import { timeAgo } from "../utils/text.ts";
import { insertTrip } from "../rpc/mobility.ts";
import { saveIntent } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";

/**
 * Start Go Online flow - prompt driver to share location
 * Simplified: no insurance check, just vehicle plate
 */
export async function startGoOnline(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Check if driver has vehicle plate registered
  const hasPlate = await ensureVehiclePlate(ctx, { type: "go_online" });
  if (!hasPlate) {
    // ensureVehiclePlate will prompt for plate entry
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
  
  // Removed confusing "Share Current Location" button - users share via attachment menu
  await sendText(
    ctx.from,
    t(ctx.locale, "mobility.go_online.prompt") + "\n\n" + t(ctx.locale, "location.share.instructions"),
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
          radiusMeters: 15000, // 15km radius (increased for better match rate)
          pickupText: "Driver online",
        });
        
        await logStructuredEvent("DRIVER_TRIP_CREATED", {
          userId: ctx.profileId,
          vehicleType,
          lat: coords.lat,
          lng: coords.lng,
        });
      } catch (tripError) {
        await logStructuredEvent("DRIVER_TRIP_CREATE_FAILED", {
          userId: ctx.profileId,
          error: tripError instanceof Error ? tripError.message : String(tripError),
        }});
        // Continue even if trip creation fails
      }

      // Save go_online intent for recommendations
      try {
        await saveIntent(ctx.supabase, {
          userId: ctx.profileId,
          intentType: "go_online",
          vehicleType,
          pickup: coords,
          expiresInMinutes: 30,
        });
      } catch (intentError) {
        await logStructuredEvent("DRIVER_INTENT_SAVE_FAILED", {
          userId: ctx.profileId,
          error: intentError instanceof Error ? intentError.message : String(intentError),
        }});
      }

      // Also try to update driver_status table if it exists
      try {
        await ctx.supabase.rpc("update_driver_status", {
          _user_id: ctx.profileId,
          _lat: coords.lat,
          _lng: coords.lng,
          _online: true,
          _vehicle_type: vehicleType,
        });
      } catch (error) {
        // Ignore if function doesn't exist yet - this is expected during migration
      }
    }

    await logStructuredEvent("DRIVER_WENT_ONLINE", {
      userId: ctx.profileId,
      lat: coords.lat,
      lng: coords.lng,
      vehicleType: vehicleType || "unknown",
    });

    // Clear state after success
    await clearState(ctx.supabase, ctx.profileId);

    // Enhanced success message with 30-minute duration
    const successMessage = `✅ *You're now LIVE!*\n\n🚗 You'll receive ride offers for the next *30 minutes*.\n\nPassengers nearby can discover you now. Good luck! 🎉`;
    
    await sendButtonsMessage(
      ctx,
      successMessage,
      homeOnly(),
    );

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    await logStructuredEvent("GO_ONLINE_LOCATION_SAVE_FAILED", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }});
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
    await logStructuredEvent("GO_ONLINE_USE_CACHED_FAILED", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }});
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
      await ctx.supabase.rpc("update_driver_status", {
        _user_id: ctx.profileId,
        _online: false,
      });
    } catch (error) {
      // Function might not exist, ignore - expected during migration
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
    await logStructuredEvent("GO_OFFLINE_FAILED", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }});
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}
