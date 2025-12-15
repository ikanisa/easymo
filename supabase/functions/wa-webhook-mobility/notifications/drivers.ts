// Driver notification system for mobility
// Notifies nearby drivers when passengers request rides

import type { SupabaseClient } from "../deps.ts";
import type { RouterContext } from "../types.ts";
import { sendButtons, sendText } from "../wa/client.ts";
import { t } from "../i18n/translator.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../wa/ids.ts";

export interface NearbyDriver {
  userId: string;
  whatsapp: string;
  distanceKm: number;
  lastLocationAt: string;
  vehicleType: string;
}

/**
 * Find nearby online drivers for a trip
 */
export async function findOnlineDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  radiusKm = 10,
  limit = 9,
): Promise<NearbyDriver[]> {
  const { data, error } = await client.rpc("find_online_drivers_near_trip", {
    _trip_id: tripId,
    _radius_km: radiusKm,
    _limit: limit,
    _minutes_online: 60, // Only drivers with location in last 60 minutes
  });

  if (error) {
    logStructuredEvent("DRIVER_NOTIFICATIONS_FIND_DRIVERS_FAIL", {
      error: error.message,
      tripId,
      radiusKm,
    }, "error");
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row: any) => ({
    userId: row.user_id,
    whatsapp: row.whatsapp_e164,
    distanceKm: Number(row.distance_km),
    lastLocationAt: row.last_location_at,
    vehicleType: row.vehicle_type,
  }));
}

/**
 * Send notification to a driver about a nearby passenger
 */
export async function notifyDriver(
  ctx: RouterContext,
  driver: NearbyDriver,
  tripDetails: {
    tripId: string;
    passengerId: string;
    vehicleType: string;
    pickupText?: string;
    dropoffText?: string;
  },
): Promise<boolean> {
  try {
    const distanceText = driver.distanceKm < 1
      ? `${Math.round(driver.distanceKm * 1000)}m`
      : `${driver.distanceKm.toFixed(1)}km`;

    const messageBody = t(ctx.locale, "mobility.driver_notification.body", {
      distance: distanceText,
      vehicle: tripDetails.vehicleType,
      pickup: tripDetails.pickupText || t(ctx.locale, "mobility.driver_notification.location_shared"),
    });

    // Send WhatsApp notification with action buttons
    await sendButtons(driver.whatsapp, messageBody, [
      {
        id: `${IDS.DRIVER_OFFER_RIDE}::${tripDetails.tripId}`,
        title: t(ctx.locale, "mobility.driver_notification.offer_ride"),
      },
      {
        id: `${IDS.DRIVER_VIEW_DETAILS}::${tripDetails.tripId}`,
        title: t(ctx.locale, "mobility.driver_notification.view_details"),
      },
    ]);

    // Record notification in database
    await ctx.supabase.rpc("record_driver_notification", {
      _trip_id: tripDetails.tripId,
      _passenger_id: tripDetails.passengerId,
      _driver_id: driver.userId,
    });

    await logStructuredEvent("DRIVER_NOTIFIED", {
      tripId: tripDetails.tripId,
      driverId: driver.userId,
      distanceKm: driver.distanceKm,
    });

    return true;
  } catch (error) {
    logStructuredEvent("DRIVER_NOTIFICATIONS_NOTIFY_FAIL", {
      driverId: driver.userId,
      tripId: tripDetails.tripId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Notify multiple drivers about a trip
 */
export async function notifyMultipleDrivers(
  ctx: RouterContext,
  drivers: NearbyDriver[],
  tripDetails: {
    tripId: string;
    passengerId: string;
    vehicleType: string;
    pickupText?: string;
    dropoffText?: string;
  },
): Promise<{ notified: number; failed: number }> {
  let notified = 0;
  let failed = 0;

  for (const driver of drivers) {
    const success = await notifyDriver(ctx, driver, tripDetails);
    if (success) {
      notified++;
    } else {
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await logStructuredEvent("DRIVERS_NOTIFICATION_BATCH", {
    tripId: tripDetails.tripId,
    totalDrivers: drivers.length,
    notified,
    failed,
  });

  return { notified, failed };
}

/**
 * Handle driver's response to ride offer
 */
export async function handleDriverResponse(
  ctx: RouterContext,
  requestId: string,
  responseType: "accept" | "reject",
): Promise<{ success: boolean; tripId?: string; passengerId?: string }> {
  try {
    // Record response
    const { data: updated } = await ctx.supabase.rpc("record_driver_response", {
      _request_id: requestId,
      _response_type: responseType,
    });

    if (!updated) {
      return { success: false };
    }

    // Get request details to notify passenger
    const { data: request } = await ctx.supabase
      .from("ride_requests")
      .select("trip_id, passenger_id, driver_id")
      .eq("id", requestId)
      .single();

    if (!request) {
      return { success: false };
    }

    await logStructuredEvent("DRIVER_RESPONSE", {
      requestId,
      tripId: request.trip_id,
      driverId: request.driver_id,
      responseType,
    });

    return {
      success: true,
      tripId: request.trip_id,
      passengerId: request.passenger_id,
    };
  } catch (error) {
    logStructuredEvent("DRIVER_NOTIFICATIONS_RESPONSE_FAIL", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return { success: false };
  }
}

/**
 * Notify passenger that a driver has accepted
 */
export async function notifyPassengerOfDriverAcceptance(
  ctx: RouterContext,
  passengerId: string,
  driverId: string,
): Promise<void> {
  try {
    // Get passenger's WhatsApp
    const { data: passenger } = await ctx.supabase
      .from("profiles")
      .select("phone_number, wa_id")
      .eq("user_id", passengerId)
      .single();

    if (!passenger) return;

    const passengerPhone = passenger.phone_number || passenger.wa_id;
    if (!passengerPhone) return;

    // Get driver details
    const { data: driver } = await ctx.supabase
      .from("profiles")
      .select("phone_number, wa_id")
      .eq("user_id", driverId)
      .single();

    if (!driver) return;

    const driverPhone = driver.phone_number || driver.wa_id;

    const message = t(ctx.locale, "mobility.passenger_notification.driver_accepted", {
      driverPhone: driverPhone?.slice(-4) || "****",
    });

    await sendButtons(passengerPhone, message, [
      {
        id: `${IDS.CONTACT_DRIVER}::${driverId}`,
        title: t(ctx.locale, "mobility.passenger_notification.contact_driver"),
      },
    ]);

    await logStructuredEvent("PASSENGER_NOTIFIED_DRIVER_ACCEPTED", {
      passengerId,
      driverId,
    });
  } catch (error) {
    logStructuredEvent("DRIVER_NOTIFICATIONS_NOTIFY_PASSENGER_FAIL", {
      passengerId,
      driverId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
  }
}
