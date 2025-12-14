// Driver response handlers
// Handles driver responses to ride notifications (accept, reject, view details)

import type { RouterContext } from "../types.ts";
import { clearState, setState } from "../state/store.ts";
import { t } from "../i18n/translator.ts";
import { IDS } from "../wa/ids.ts";
import { sendText, sendButtons } from "../wa/client.ts";
import { sendButtonsMessage, homeOnly } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { waChatLink } from "../utils/links.ts";
import {
  handleDriverResponse as recordDriverResponse,
  notifyPassengerOfDriverAcceptance,
} from "../notifications/drivers.ts";

/**
 * Parse driver action button ID
 * Format: "driver_offer_ride::tripId" or "driver_view_details::tripId"
 */
function parseDriverActionId(id: string): { action: string; tripId: string } | null {
  const parts = id.split("::");
  if (parts.length !== 2) return null;
  return {
    action: parts[0],
    tripId: parts[1],
  };
}

/**
 * Handle when driver taps "Offer Ride"
 */
export async function handleDriverOfferRide(
  ctx: RouterContext,
  tripId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get trip details
    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, creator_user_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type, pickup_text, dropoff_text")
      .eq("id", tripId)
      .single();

    if (!trip) {
      await sendText(ctx.from, t(ctx.locale, "mobility.driver_response.trip_not_found", {
        defaultValue: "This trip request is no longer available.",
      }));
      return true;
    }

    // Get the ride request ID
    const { data: request } = await ctx.supabase
      .from("ride_requests")
      .select("id")
      .eq("trip_id", tripId)
      .eq("driver_id", ctx.profileId)
      .eq("status", "pending")
      .maybeSingle();

    if (!request) {
      await sendText(ctx.from, t(ctx.locale, "mobility.driver_response.already_responded", {
        defaultValue: "You've already responded to this request or it has expired.",
      }));
      return true;
    }

    // Record driver's acceptance
    const response = await recordDriverResponse(ctx, request.id, "accept");
    
    if (!response.success) {
      await sendText(ctx.from, t(ctx.locale, "mobility.driver_response.error", {
        defaultValue: "Something went wrong. Please try again.",
      }));
      return true;
    }

    // Get passenger details
    const { data: passenger } = await ctx.supabase
      .from("profiles")
      .select("phone_number, wa_id")
      .eq("user_id", trip.creator_user_id)
      .single();

    if (!passenger) {
      await sendText(ctx.from, t(ctx.locale, "mobility.driver_response.passenger_not_found", {
        defaultValue: "Could not find passenger details.",
      }));
      return true;
    }

    const passengerPhone = passenger.phone_number || passenger.wa_id;

    // Notify passenger
    if (response.passengerId) {
      await notifyPassengerOfDriverAcceptance(ctx, response.passengerId, ctx.profileId);
    }

    // Send driver confirmation with WhatsApp link
    const prefilledMessage = t(ctx.locale, "mobility.driver_response.contact_message", {
      defaultValue: "Hi! I'm available to give you a ride.",
    });
    const link = waChatLink(passengerPhone, prefilledMessage);

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "mobility.driver_response.accepted", {
        defaultValue: `✅ Great! We've notified the passenger. Contact them to confirm details:\n\n${link}`,
        link,
      }),
      homeOnly(),
    );

    await logStructuredEvent("DRIVER_ACCEPTED_RIDE", {
      tripId,
      driverId: ctx.profileId,
      passengerId: trip.creator_user_id,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("DRIVER_OFFER_RIDE_FAILED", {
      tripId,
      driverId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}

/**
 * Handle when driver taps "View Details"
 */
export async function handleDriverViewDetails(
  ctx: RouterContext,
  tripId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get trip details
    const { data: trip } = await ctx.supabase
      .from("trips")
      .select("id, creator_user_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type, pickup_text, dropoff_text, created_at")
      .eq("id", tripId)
      .single();

    if (!trip) {
      await sendText(ctx.from, t(ctx.locale, "mobility.driver_response.trip_not_found", {
        defaultValue: "This trip request is no longer available.",
      }));
      return true;
    }

    // Calculate distance from driver's current location (if available)
    let distanceText = "";
    if (ctx.profileId) {
      try {
        const { data: driverLocation } = await ctx.supabase.rpc("get_cached_location", {
          _user_id: ctx.profileId,
          _cache_minutes: 60,
        });

        if (driverLocation && driverLocation.length > 0 && driverLocation[0].is_valid) {
          const driverLat = driverLocation[0].lat;
          const driverLng = driverLocation[0].lng;
          
          // Haversine distance
          const R = 6371; // Earth radius in km
          const dLat = (trip.pickup_lat - driverLat) * Math.PI / 180;
          const dLng = (trip.pickup_lng - driverLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(driverLat * Math.PI / 180) * Math.cos(trip.pickup_lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          distanceText = distance < 1 
            ? `\n📍 Distance: ${Math.round(distance * 1000)}m`
            : `\n📍 Distance: ${distance.toFixed(1)}km`;
        }
      } catch (error) {
        // Distance calculation failure is non-critical, continue without distance
      }
    }

    const pickupInfo = trip.pickup_text || `📍 ${trip.pickup_lat.toFixed(5)}, ${trip.pickup_lng.toFixed(5)}`;
    const dropoffInfo = trip.dropoff_lat && trip.dropoff_lng
      ? `\n🎯 Dropoff: ${trip.dropoff_text || `${trip.dropoff_lat.toFixed(5)}, ${trip.dropoff_lng.toFixed(5)}`}`
      : "";

    const details = t(ctx.locale, "mobility.driver_response.trip_details", {
      defaultValue: `🚗 Trip Details\n\n🚙 Vehicle: ${trip.vehicle_type}\n📍 Pickup: ${pickupInfo}${dropoffInfo}${distanceText}\n\n⏰ Requested: ${new Date(trip.created_at).toLocaleTimeString()}`,
      vehicle: trip.vehicle_type,
      pickup: pickupInfo,
      dropoff: dropoffInfo,
      distance: distanceText,
      time: new Date(trip.created_at).toLocaleTimeString(),
    });

    await sendButtons(ctx.from, details, [
      {
        id: `${IDS.DRIVER_OFFER_RIDE}::${tripId}`,
        title: t(ctx.locale, "mobility.driver_notification.offer_ride"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ]);

    await logStructuredEvent("DRIVER_VIEWED_DETAILS", {
      tripId,
      driverId: ctx.profileId,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("DRIVER_VIEW_DETAILS_FAILED", {
      tripId,
      driverId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.error"));
    return true;
  }
}

/**
 * Route driver action button presses
 */
export async function routeDriverAction(
  ctx: RouterContext,
  buttonId: string,
): Promise<boolean> {
  const parsed = parseDriverActionId(buttonId);
  if (!parsed) return false;

  if (parsed.action === IDS.DRIVER_OFFER_RIDE) {
    return await handleDriverOfferRide(ctx, parsed.tripId);
  } else if (parsed.action === IDS.DRIVER_VIEW_DETAILS) {
    return await handleDriverViewDetails(ctx, parsed.tripId);
  }

  return false;
}
