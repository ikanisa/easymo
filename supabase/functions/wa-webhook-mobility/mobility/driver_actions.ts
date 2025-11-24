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
    .from("rides_trips")
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

  // Update last location in metadata for consistency across flows
  try {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("metadata")
      .eq("user_id", ctx.profileId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    const metadata = (data?.metadata && typeof data.metadata === 'object' && data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
    const mobility = (metadata.mobility && typeof metadata.mobility === 'object')
      ? { ...(metadata.mobility as Record<string, unknown>) }
      : {};
    mobility.last_location = { lat: coords.lat, lng: coords.lng, capturedAt: new Date().toISOString() };
    metadata.mobility = mobility;
    await ctx.supabase
      .from("profiles")
      .update({ metadata })
      .eq("user_id", ctx.profileId);
  } catch (e) {
    console.warn('driver.last_location_meta_fail', e);
  }

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

export async function handleGoOffline(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    await ctx.supabase
      .from('driver_status')
      .update({ online: false, last_seen: new Date().toISOString() })
      .eq('user_id', ctx.profileId);
  } catch (e) {
    // non-fatal
  }
  await sendButtonsMessage(
    ctx,
    '🔴 You are now Offline. You will not receive new ride requests.',
    [{ id: IDS.BACK_MENU, title: 'Back to Menu' }]
  );
  return true;
}
