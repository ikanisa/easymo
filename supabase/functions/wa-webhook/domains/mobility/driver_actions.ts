import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { IDS } from "../../wa/ids.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { maskPhone } from "../../flows/support.ts";
import { waChatLink } from "../../utils/links.ts";
import { recordDriverPresence } from "../../rpc/mobility.ts";
import { setState } from "../../state/store.ts";

export async function handleDriverAcceptRide(
  ctx: RouterContext,
  tripId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // 1. Check if trip is still open
  const { data: trip, error } = await ctx.supabase
    .from("trips")
    .select("*, profiles!creator_user_id(whatsapp_number)")
    .eq("id", tripId)
    .single();

  if (error || !trip || trip.status !== "open") {
    await sendButtonsMessage(
      ctx,
      "⚠️ This ride request is no longer available.",
      [{ id: IDS.BACK_MENU, title: "Back" }]
    );
    return true;
  }

  // 2. Create ride request record
  const { error: reqError } = await ctx.supabase
    .from("ride_requests")
    .insert({
      trip_id: tripId,
      passenger_id: trip.creator_user_id,
      driver_id: ctx.profileId,
      status: "accepted",
    });

  if (reqError) {
    console.error("ride_accept_fail", reqError);
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not accept ride. Please try again.",
      [{ id: IDS.BACK_MENU, title: "Back" }]
    );
    return true;
  }

  // 3. Notify Driver (Confirmation)
  const passengerPhone = trip.profiles?.whatsapp_number;
  const link = passengerPhone ? waChatLink(passengerPhone, "Hi! I accepted your ride request on easyMO.") : "";
  
  await sendButtonsMessage(
    ctx,
    `✅ You accepted the ride!\n\nContact the passenger: ${link}`,
    [{ id: IDS.BACK_MENU, title: "Done" }]
  );

  // 4. Notify Passenger
  if (passengerPhone) {
    // Get driver details
    const { data: driver } = await ctx.supabase
      .from("profiles")
      .select("whatsapp_number, full_name")
      .eq("user_id", ctx.profileId)
      .single();
      
    const driverPhone = driver?.whatsapp_number;
    const driverName = driver?.full_name ?? "A driver";
    const driverLink = driverPhone ? waChatLink(driverPhone, "Hi! I see you accepted my ride request.") : "";

    // We use a direct message here for speed
    // In a real prod env, we might want to use a template if outside 24h window, 
    // but usually this happens within the window.
    const { sendText } = await import("../../wa/client.ts");
    await sendText(
      passengerPhone,
      `🚗 **Ride Accepted!**\n\n${driverName} has accepted your request.\n\nTap to chat: ${driverLink}`
    );
  }

  await logStructuredEvent("RIDE_ACCEPTED", {
    tripId,
    driverId: ctx.profileId,
    passengerId: trip.creator_user_id,
  });

  return true;
}

export async function handleGoOnline(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Ask for location to go online
  await setState(ctx.supabase, ctx.profileId, {
    key: "driver_go_online",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    "📍 Share your current location to go online and receive ride requests.",
    [{ id: IDS.LOCATION_SAVED_LIST, title: "Saved Places" }]
  );
  
  return true;
}

export async function handleDriverLocationUpdate(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Update profile last_location
  await ctx.supabase
    .from("profiles")
    .update({
      last_location: `SRID=4326;POINT(${coords.lng} ${coords.lat})`,
      last_location_at: new Date().toISOString(),
    })
    .eq("user_id", ctx.profileId);

  // Also update driver_status (legacy/compatibility)
  // We assume vehicle type is stored or default to 'veh_moto' if not found for now, 
  // or we could ask. For shortcut, let's try to get stored or default.
  const { data: pref } = await ctx.supabase
    .from("user_preferences")
    .select("vehicle_type")
    .eq("user_id", ctx.profileId)
    .maybeSingle();
    
  const vehicleType = pref?.vehicle_type ?? "veh_moto";

  await recordDriverPresence(ctx.supabase, ctx.profileId, {
    vehicleType,
    lat: coords.lat,
    lng: coords.lng,
  });

  await sendButtonsMessage(
    ctx,
    "✅ You are now Online! We will notify you when passengers are nearby.",
    [{ id: IDS.BACK_MENU, title: "Back to Menu" }]
  );

  return true;
}
