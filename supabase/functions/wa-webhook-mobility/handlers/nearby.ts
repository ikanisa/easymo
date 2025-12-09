import type { ButtonSpec, RouterContext } from "../types.ts";
import { clearState, setState } from "../state/store.ts";
import { t } from "../i18n/translator.ts";
import { IDS } from "../wa/ids.ts";
import {
  createTripMatch,
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
  updateTripDropoff,
} from "../rpc/mobility.ts";
import { MOBILITY_CONFIG } from "../../_shared/wa-webhook-shared/config/mobility.ts";
import { getAppConfig } from "../utils/app_config.ts";
import { waChatLink } from "../utils/links.ts";
import { maskPhone } from "../flows/support.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { emitAlert } from "../observe/alert.ts";
import { timeAgo, safeRowTitle } from "../utils/text.ts";
import { sendText } from "../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsDirect,
  sendButtonsMessage,
  sendListMessage,
} from "../utils/reply.ts";
import {
  ensureVehiclePlate,
  getStoredVehicleType,
  updateStoredVehicleType,
} from "./vehicle_plate.ts";
import { getRecentNearbyIntent, storeNearbyIntent } from "./intent_cache.ts";
import { saveIntent, getRecentIntents } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { routeToAIAgent, sendAgentOptions } from "../ai-agents/index.ts";
import { reverseGeocode } from "../../_shared/wa-webhook-shared/locations/geocoding.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";
import { checkLocationCache } from "./location_cache.ts";
import { readLastLocation } from "../locations/favorites.ts";
import { sortMatches } from "../../_shared/wa-webhook-shared/utils/sortMatches.ts";
import { 
  getCachedLocation,
  hasAnyRecentLocation,
  getLastLocation,
} from "../locations/cache.ts";
import { saveUserLocation } from "../locations/save_location.ts";

// Use centralized config for all mobility constants
const DEFAULT_WINDOW_DAYS = MOBILITY_CONFIG.DEFAULT_WINDOW_DAYS;
const REQUIRED_RADIUS_METERS = MOBILITY_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
const DEFAULT_RADIUS_METERS = MOBILITY_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
const MAX_RADIUS_METERS = MOBILITY_CONFIG.MAX_SEARCH_RADIUS_METERS;
const SAVED_ROW_PREFIX = "FAV::";

const VEHICLE_OPTION_DEFS = [
  {
    id: "veh_moto",
    titleKey: "mobility.nearby.vehicle.moto.title",
    descriptionKey: "mobility.nearby.vehicle.moto.description",
    fallbackTitle: "Moto taxi",
    fallbackDescription: "Two-wheel rides around town.",
  },
  {
    id: "veh_cab",
    titleKey: "mobility.nearby.vehicle.cab.title",
    descriptionKey: "mobility.nearby.vehicle.cab.description",
    fallbackTitle: "Cab",
    fallbackDescription: "Standard car trips.",
  },
  {
    id: "veh_lifan",
    titleKey: "mobility.nearby.vehicle.lifan.title",
    descriptionKey: "mobility.nearby.vehicle.lifan.description",
    fallbackTitle: "Lifan",
    fallbackDescription: "Three-wheel cargo rides.",
  },
  {
    id: "veh_truck",
    titleKey: "mobility.nearby.vehicle.truck.title",
    descriptionKey: "mobility.nearby.vehicle.truck.description",
    fallbackTitle: "Truck",
    fallbackDescription: "Pickup or truck deliveries.",
  },
  {
    id: "veh_others",
    titleKey: "mobility.nearby.vehicle.other.title",
    descriptionKey: "mobility.nearby.vehicle.other.description",
    fallbackTitle: "Other vehicles",
    fallbackDescription: "Anything else (buses, vans, etc.).",
  },
] as const;

export const VEHICLE_OPTIONS = VEHICLE_OPTION_DEFS.map((def) => ({
  id: def.id,
  title: def.fallbackTitle,
  description: def.fallbackDescription,
}));

type NearbyMode = "drivers" | "passengers";

type NearbyStateRow = {
  id: string;
  whatsapp: string;
  ref: string;
  tripId: string;
};

export type NearbyState = {
  mode: NearbyMode;
  vehicle?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  rows?: NearbyStateRow[];
  myTripId?: string; // The trip ID created for the current user
};

type NearbySnapshot = {
  mode: NearbyMode;
  vehicle: string;
  pickup?: { lat: number; lng: number } | null;
};

export type NearbySavedPickerState = {
  source: "nearby";
  stage: "pickup" | "dropoff";
  snapshot: NearbySnapshot;
};

function getMatchTimestamp(match: MatchResult): string | null {
  return match.matched_at ?? match.created_at ?? null;
}

function timestampMs(match: MatchResult): number {
  const timestamp = getMatchTimestamp(match);
  return timestamp ? Date.parse(timestamp) : 0;
}

export function vehicleFromId(id: string): string {
  return id.replace("veh_", "");
}

function requiredRadius(configRadiusKm?: number | null): number {
  if (!Number.isFinite(configRadiusKm ?? NaN)) return DEFAULT_RADIUS_METERS;
  const meters = Math.round(Number(configRadiusKm) * 1000);
  if (!Number.isFinite(meters) || meters <= 0) return DEFAULT_RADIUS_METERS;
  return Math.min(
    Math.max(meters, DEFAULT_RADIUS_METERS),
    MAX_RADIUS_METERS,
  );
}

function toDistanceLabel(distanceKm: unknown): string | null {
  const num = typeof distanceKm === "number" ? distanceKm : Number(distanceKm);
  if (!Number.isFinite(num)) return null;
  if (num >= 1) return `${num.toFixed(1)} km`;
  return `${Math.round(num * 1000)} m`;
}

/**
 * Eclipse phone number for privacy (e.g., "+250788123456" -> "***3456")
 */
function eclipsePhone(phone: string): string {
  if (!phone) return "";
  // Remove any non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Get last 4 digits
  const last4 = cleaned.slice(-4);
  return `***${last4}`;
}

function buildNearbyRow(
  ctx: RouterContext,
  match: MatchResult,
): {
  row: { id: string; title: string; description?: string };
  state: NearbyStateRow;
} {
  const distanceLabel = toDistanceLabel(match.distance_km);
  
  // Use created_at for "listed time" (when trip was created)
  const listedTime = timeAgo(match.created_at ?? new Date().toISOString());
  
  // Build title based on role
  let title: string;
  if (match.role === "driver") {
    // For drivers: show number plate (or fallback to ref code)
    const plate = match.number_plate?.trim();
    title = plate || match.ref_code || `Driver ${match.trip_id.slice(0, 8)}`;
  } else {
    // For passengers: show eclipsed phone number
    const eclipsed = eclipsePhone(match.whatsapp_e164 ?? "");
    title = eclipsed || match.ref_code || `Passenger ${match.trip_id.slice(0, 8)}`;
  }
  
  // Ensure title is safe for WhatsApp
  title = safeRowTitle(title.trim());
  
  // Build description: Distance • Listed time
  const descriptionParts: string[] = [];
  if (distanceLabel) {
    descriptionParts.push(distanceLabel);
  }
  descriptionParts.push(`Listed ${listedTime}`);
  
  const rowId = `MTCH::${match.trip_id}`;
  return {
    row: {
      id: rowId,
      title: title,
      description: descriptionParts.join(" • "),
    },
    state: {
      id: rowId,
      whatsapp: match.whatsapp_e164 ?? "",
      ref: match.ref_code ?? "---",
      tripId: match.trip_id,
    },
  };
}

import { checkPendingPayments } from "./trip_payment.ts";
import { fmtCurrency } from "../utils/text.ts";

export async function handleSeeDrivers(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // 0. Check for pending payments
  const pending = await checkPendingPayments(ctx);
  if (pending) {
    const formattedAmount = fmtCurrency(pending.amount, "RWF");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "payment.reminder.pending", { amount: formattedAmount }),
      homeOnly()
    );
    return true;
  }
  
  // 1. Standard workflow: always ask for vehicle selection
  // This provides a clean, predictable user experience
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode: "drivers" },
  });
  
  await sendVehicleSelector(ctx, "drivers");
  return true;
}

/**
 * Handle selection from recent searches list
 */
export async function handleRecentSearchSelection(
  ctx: RouterContext,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Handle "Share New Location" option
  if (selectionId === "SHARE_NEW_LOCATION") {
    const state = await ctx.supabase
      .from("user_state")
      .select("data")
      .eq("user_id", ctx.profileId)
      .eq("key", "mobility_nearby_select")
      .single();

    const mode = state.data?.data?.mode || "drivers";
    await sendVehicleSelector(ctx, mode);
    return true;
  }

  // Parse coordinates from selection ID: "RECENT_SEARCH::0::lat,lng"
  if (!selectionId.startsWith("RECENT_SEARCH::")) {
    return false;
  }

  const parts = selectionId.split("::");
  if (parts.length < 3) return false;

  const coords = parts[2].split(",");
  if (coords.length !== 2) return false;

  const lat = parseFloat(coords[0]);
  const lng = parseFloat(coords[1]);

  if (isNaN(lat) || isNaN(lng)) return false;

  // Get the current state to know mode
  const state = await ctx.supabase
    .from("user_state")
    .select("data")
    .eq("user_id", ctx.profileId)
    .eq("key", "mobility_nearby_select")
    .single();

  const mode = state.data?.data?.mode || "drivers";
  const vehicle = "veh_moto"; // Default, will be refined later

  // Execute search with these coordinates
  return await handleNearbyLocation(ctx, { mode: mode as any, vehicle }, { lat, lng });
}

export async function handleSeePassengers(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const ready = await ensureVehiclePlate(ctx, { type: "nearby_passengers" });
  if (!ready) return true;

  // Standard workflow: check if user has stored vehicle preference
  // If yes, use it and ask for location
  // If no, ask for vehicle selection
  const storedVehicle = await getStoredVehicleType(
    ctx.supabase,
    ctx.profileId,
  );
  if (storedVehicle) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_location",
      data: { mode: "passengers", vehicle: storedVehicle },
    });
    await promptShareLocation(ctx, { mode: "passengers", vehicle: storedVehicle }, {
      allowVehicleChange: true,
    });
    return true;
  }

  // No stored vehicle - ask user to select one
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode: "passengers" },
  });
  await sendVehicleSelector(ctx, "passengers");
  return true;
}

export async function handleVehicleSelection(
  ctx: RouterContext,
  state: NearbyState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const vehicleType = vehicleFromId(id);
  if (state.mode === "passengers") {
    await updateStoredVehicleType(ctx.supabase, ctx.profileId, vehicleType);
  }
  
  // Check cache first (30 min TTL)
  const cached = await getCachedLocation(ctx.supabase, ctx.profileId);
  if (cached && cached.isValid) {
    // Use cached location directly, skip prompt
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_location",
      data: { mode: state.mode, vehicle: vehicleType },
    });
    return await handleNearbyLocation(ctx, { mode: state.mode, vehicle: vehicleType }, { lat: cached.lat, lng: cached.lng });
  }
  
  // Cache expired or doesn't exist - prompt with "Use Last Location" button
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_location",
    data: { mode: state.mode, vehicle: vehicleType },
  });
  await promptShareLocation(ctx, { mode: state.mode, vehicle: vehicleType }, {
    allowVehicleChange: state.mode === "passengers",
  });
  return true;
}

export async function handleNearbyRecent(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    // Prefer last drivers intent; fallback to passengers
    const drivers = await getRecentNearbyIntent(ctx.supabase, ctx.profileId, 'drivers');
    const passengers = await getRecentNearbyIntent(ctx.supabase, ctx.profileId, 'passengers');
    const pick = drivers || passengers;
    if (!pick) {
      await sendButtonsMessage(ctx, t(ctx.locale, 'mobility.nearby.no_recent_search'), buildButtons(
        { id: IDS.SEE_DRIVERS, title: t(ctx.locale, 'mobility.nearby.buttons.drivers') },
        { id: IDS.SEE_PASSENGERS, title: t(ctx.locale, 'mobility.nearby.buttons.passengers') },
      ));
      return true;
    }
    const mode = drivers ? 'drivers' : 'passengers';
    const vehicle = pick.vehicle || 'veh_moto';
    const coords = { lat: pick.lat, lng: pick.lng };
    if (mode === 'drivers') {
      await setState(ctx.supabase, ctx.profileId, { key: 'mobility_nearby_location', data: { mode, vehicle, pickup: coords } });
    } else {
      await setState(ctx.supabase, ctx.profileId, { key: 'mobility_nearby_location', data: { mode, vehicle } });
    }
    return await handleNearbyLocation(ctx, { mode: mode as any, vehicle }, coords);
  } catch (e) {
    await sendButtonsMessage(ctx, t(ctx.locale, 'mobility.nearby.recent_load_error'), buildButtons({ id: IDS.BACK_MENU, title: t(ctx.locale, 'common.buttons.back') }));
    await sendButtonsMessage(ctx, t(ctx.locale, "mobility.nearby.recent_load_error"), buildButtons({ id: IDS.BACK_MENU, title: 'Back' }));
    return true;
  }
}

export async function handleUseCachedLocation(
  ctx: RouterContext,
  state: NearbyState,
): Promise<boolean> {
  if (!ctx.profileId || !state?.mode || !state?.vehicle) return false;

  let pickup = state.pickup ?? null;
  if (!pickup) {
    const last = await readLastLocation(ctx);
    if (last) {
      pickup = { lat: last.lat, lng: last.lng };
    }
  }

  if (!pickup) {
    await promptShareLocation(ctx, state, {
      allowVehicleChange: state.mode === "passengers",
    });
    return true;
  }

  return await handleNearbyLocation(ctx, { ...state, pickup }, pickup);
}

export async function handleNearbyLocation(
  ctx: RouterContext,
  state: NearbyState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.vehicle || !state.mode) return false;

  const isDriverRequest = state.mode === "drivers";
  const pickup = coords;
  let updatedState = state;

  if (isDriverRequest) {
    updatedState = { ...state, pickup };
    // We'll update state again after trip creation to include the ID
  }

  // Save location to cache and history
  await saveUserLocation(ctx, coords, 'mobility');

  try {
    await storeNearbyIntent(ctx.supabase, ctx.profileId, state.mode, {
      vehicle: state.vehicle,
      lat: pickup.lat,
      lng: pickup.lng,
    });
  } catch (error) {
    console.error("mobility.nearby_cache_write_fail", error);
  }

  // DIRECT DATABASE MATCHING: Simple workflow for Phase 1
  // User shares location → Instant database query → Top 9 results
  // Note: AI agent integration planned for Phase 2
  return await runMatchingFallback(ctx, updatedState, pickup);
}



export async function handleNearbyResultSelection(
  ctx: RouterContext,
  state: NearbyState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.myTripId) {
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.session_expired"));
    return true;
  }

  // Extract the actual trip ID from the list row identifier
  const tripId = id.startsWith("MTCH::") ? id.replace("MTCH::", "") : id;
  
  try {
    // Fetch the selected trip details
    const { data: selectedTrip, error: tripError } = await ctx.supabase
      .from("trips")
      .select("user_id, role, vehicle_type, pickup_lat, pickup_lng")
      .eq("id", tripId)
      .single();
      
    if (tripError || !selectedTrip) {
      await sendText(ctx.from, t(ctx.locale, "mobility.nearby.match_unavailable"));
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
    
    // Fetch user phone numbers for both users
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("user_id, whatsapp_number, phone_number, wa_id")
      .in("user_id", [ctx.profileId, selectedTrip.user_id]);
    
    const myProfile = profiles?.find(p => p.user_id === ctx.profileId);
    const otherProfile = profiles?.find(p => p.user_id === selectedTrip.user_id);

    const resolveWhatsApp = (profile?: any) =>
      profile?.whatsapp_number || profile?.phone_number || profile?.wa_id;
    const myWa = resolveWhatsApp(myProfile);
    const otherWa = resolveWhatsApp(otherProfile);
    
    if (!myWa || !otherWa) {
      await sendText(ctx.from, t(ctx.locale, "mobility.nearby.match_error"));
      return true;
    }
    
    // Determine roles - if searching for drivers, I'm the passenger
    const isPassenger = state.mode === "drivers";
    const passengerTripId = isPassenger ? state.myTripId : tripId;
    const driverTripId = isPassenger ? tripId : state.myTripId;
    const passengerUserId = isPassenger ? ctx.profileId : selectedTrip.user_id;
    const driverUserId = isPassenger ? selectedTrip.user_id : ctx.profileId;
    const passengerPhone = isPassenger ? myWa : otherWa;
    const driverPhone = isPassenger ? otherWa : myWa;
    
    // Create the match using existing RPC function
    await createTripMatch(ctx.supabase, {
      driverTripId,
      passengerTripId,
      driverUserId,
      passengerUserId,
      vehicleType: state.vehicle || selectedTrip.vehicle_type,
      pickupLocation: `POINT(${selectedTrip.pickup_lng} ${selectedTrip.pickup_lat})`,
      driverPhone,
      passengerPhone,
    });
    
    // Log success
    await logStructuredEvent("MATCH_CREATED", {
      passengerTripId,
      driverTripId,
      via: "nearby_selection",
      mode: state.mode,
      vehicle: state.vehicle,
    });
    
    // Clear state and notify user
    await clearState(ctx.supabase, ctx.profileId);
    
    const successMessage = isPassenger 
      ? t(ctx.locale, "mobility.nearby.driver_notified")
      : t(ctx.locale, "mobility.nearby.passenger_notified");
    
    await sendButtonsMessage(ctx, successMessage, homeOnly());
    
    return true;
  } catch (err) {
    console.error("handleNearbyResultSelection error:", err);
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.match_error"));
    await logStructuredEvent("MATCH_CREATION_ERROR", {
      error: String(err),
      mode: state.mode,
      myTripId: state.myTripId,
      selectedId: id,
    });
    return true;
  }
}

export async function handleChangeVehicleRequest(
  ctx: RouterContext,
  data: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const modeRaw = typeof data?.mode === "string" ? data.mode : null;
  const mode: NearbyMode = modeRaw === "drivers" ? "drivers" : "passengers";
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode },
  });
  await sendVehicleSelector(ctx, mode);
  return true;
}

export async function startNearbySavedLocationPicker(
  ctx: RouterContext,
  state: NearbyState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const snapshot = snapshotNearbyState(state);
  if (!snapshot) return false;
  const favorites = await listFavorites(ctx);
  const stage: NearbySavedPickerState["stage"] = state.mode === "drivers"
    ? "pickup"
    : state.pickup
    ? "dropoff"
    : "pickup";
  await setState(ctx.supabase, ctx.profileId, {
    key: "location_saved_picker",
    data: {
      source: "nearby",
      stage,
      snapshot,
    } satisfies NearbySavedPickerState,
  });
  const baseBody = t(ctx.locale, "location.saved.list.body", {
    context: stage === "pickup"
      ? t(ctx.locale, "location.context.pickup")
      : t(ctx.locale, "location.context.dropoff"),
  });
  const body = favorites.length
    ? baseBody
    : `${baseBody}\n\n${t(ctx.locale, "location.saved.list.empty")}`;
  
  // Check for cached location (last 30 minutes)
  const rows: Array<{ id: string; title: string; description?: string }> = [];
  const lastLoc = await readLastLocation(ctx);
  if (lastLoc && lastLoc.capturedAt) {
    const capturedTime = new Date(lastLoc.capturedAt);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - capturedTime.getTime()) / (1000 * 60));
    
    if (minutesAgo <= 30) {
      rows.push({
        id: "USE_CURRENT_LOCATION",
        title: "📍 Current Location",
        description: `Last updated ${minutesAgo} min${minutesAgo === 1 ? '' : 's'} ago`,
      });
    }
  }
  
  rows.push(
    ...favorites.map((favorite) => favoriteToRow(ctx, favorite)),
    ...buildSaveRows(ctx),
    {
      id: IDS.BACK_MENU,
      title: t(ctx.locale, "common.menu_back"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  );
  
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.list.title"),
      body,
      sectionTitle: t(ctx.locale, "location.saved.list.section"),
      rows,
      buttonText: t(ctx.locale, "location.saved.list.button"),
    },
    { emoji: "⭐" },
  );
  return true;
}

export async function handleNearbySavedLocationSelection(
  ctx: RouterContext,
  pickerState: NearbySavedPickerState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Handle "Use Current Location"
  if (selectionId === "USE_CURRENT_LOCATION") {
    const lastLoc = await readLastLocation(ctx);
    if (!lastLoc) {
      await sendButtonsMessage(
        ctx,
        "⚠️ Current location not available. Please share your location first.",
        homeOnly(),
      );
      return true;
    }
    
    const restored: NearbyState = {
      mode: pickerState.snapshot.mode,
      vehicle: pickerState.snapshot.vehicle,
      pickup: pickerState.snapshot.pickup ?? undefined,
    };
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_location",
      data: restored,
    });
    return await handleNearbyLocation(ctx, restored, {
      lat: lastLoc.lat,
      lng: lastLoc.lng,
    });
  }
  
  const favoriteId = parseFavoriteRowId(selectionId);
  if (!favoriteId) return false;
  const favorite = await getFavoriteById(ctx, favoriteId);
  if (!favorite) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.list.expired"),
      homeOnly(),
    );
    return true;
  }
  const restored: NearbyState = {
    mode: pickerState.snapshot.mode,
    vehicle: pickerState.snapshot.vehicle,
    pickup: pickerState.snapshot.pickup ?? undefined,
  };
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_location",
    data: restored,
  });
  return await handleNearbyLocation(ctx, restored, {
    lat: favorite.lat,
    lng: favorite.lng,
  });
}

export function isVehicleOption(id: string): boolean {
  return VEHICLE_OPTION_DEFS.some((opt) => opt.id === id);
}

function buildVehicleOptions(locale: RouterContext["locale"]) {
  return VEHICLE_OPTION_DEFS.map((def) => ({
    id: def.id,
    title: t(locale, def.titleKey),
    description: t(locale, def.descriptionKey),
  }));
}

async function sendVehicleSelector(ctx: RouterContext, mode: NearbyMode) {
  const rows = [
    ...buildVehicleOptions(ctx.locale),
    {
      id: IDS.BACK_MENU,
      title: t(ctx.locale, "common.menu_back"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  ];
  try {
    await sendListMessage(
      ctx,
      {
        title: mode === "drivers"
          ? t(ctx.locale, "mobility.nearby.title.drivers")
          : t(ctx.locale, "mobility.nearby.title.passengers"),
        body: t(ctx.locale, "mobility.nearby.vehicle_prompt"),
        sectionTitle: t(ctx.locale, "mobility.nearby.vehicle_section"),
        rows,
        buttonText: t(ctx.locale, "common.buttons.choose"),
      },
      { emoji: mode === "drivers" ? "🚖" : "🧭" },
    );
  } catch (e) {
    const body = t(ctx.locale, "mobility.nearby.vehicle_prompt");
    try {
      await sendText(ctx.from, body);
    } catch (_) {
      // last resort: ignore
    }
  }
}

/**
 * Show user's recent search locations for quick re-search
 * Returns true if recent searches were shown, false if none available
 */
async function showRecentSearches(
  ctx: RouterContext,
  state: NearbyState,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const intentType = state.mode === "drivers" ? "nearby_drivers" : "nearby_passengers";
    const recentIntents = await getRecentIntents(
      ctx.supabase,
      ctx.profileId,
      intentType,
      3, // Show last 3 searches
    );

    if (!recentIntents || recentIntents.length === 0) {
      return false; // No recent searches
    }

    // Build list rows from recent intents with reverse geocoding
    const rows = await Promise.all(recentIntents.map(async (intent, i) => {
      const when = timeAgo(intent.created_at);
      
      // Try to get human-readable address
      let locationText = "";
      try {
        const geocoded = await reverseGeocode(intent.pickup_lat, intent.pickup_lng, { timeout: 2000 });
        if (geocoded) {
          // Use short address (street name or area)
          locationText = geocoded.address || geocoded.city || "";
        }
      } catch (error) {
        console.warn("Failed to geocode recent search:", error);
      }
      
      // Fallback to "Unknown location" if geocoding failed (never show coordinates!)
      const displayLocation = locationText || "Unknown location";
      
      return {
        id: `RECENT_SEARCH::${i}::${intent.pickup_lat},${intent.pickup_lng}`,
        title: `📍 ${when}`,
        description: `${intent.vehicle_type} · ${displayLocation}`,
      };
    }));

    // Add option to share new location
    rows.push({
      id: "SHARE_NEW_LOCATION",
      title: t(ctx.locale, "mobility.nearby.new_location"),
      description: t(ctx.locale, "mobility.nearby.new_location.desc"),
    });

    await sendListMessage(ctx, {
      title: t(ctx.locale, "mobility.nearby.recent_searches") || "Recent Searches",
      body: t(ctx.locale, "mobility.nearby.recent_searches.body") || "Quick search from a recent location, or share a new one:",
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose") || "Choose",
    });

    return true;
  } catch (error) {
    console.error("Failed to load recent searches:", error);
    return false; // Fall back to normal flow
  }
}

async function promptShareLocation(
  ctx: RouterContext,
  state: NearbyState,
  options: { allowVehicleChange?: boolean } = {},
): Promise<void> {
  const buttons: ButtonSpec[] = [];
  
  // Check if user has recent location for "Use Last Location" button
  const hasRecent = ctx.profileId ? await hasAnyRecentLocation(ctx.supabase, ctx.profileId) : false;
  
  if (hasRecent) {
    const { getUseLastLocationButton } = await import("../../_shared/wa-webhook-shared/locations/messages.ts");
    const button = getUseLastLocationButton(ctx.locale);
    buttons.push({
      id: IDS.USE_LAST_LOCATION,
      title: button.title,
    });
  }
  
  if (options.allowVehicleChange) {
    buttons.push({
      id: IDS.MOBILITY_CHANGE_VEHICLE,
      title: t(ctx.locale, "mobility.nearby.change_vehicle"),
    });
  }
  
  buttons.push({
    id: IDS.LOCATION_SAVED_LIST,
    title: t(ctx.locale, "location.saved.button"),
  });
  
  // Use standardized location sharing message
  const { getShareLocationPrompt } = await import("../../_shared/wa-webhook-shared/locations/messages.ts");
  const body = getShareLocationPrompt(ctx.locale, hasRecent);
    
  try {
    await sendButtonsMessage(
      ctx,
      body,
      buttons,
    );
  } catch (e) {
    try {
      await sendText(ctx.from, body);
    } catch (_) {
      // swallow
    }
  }
}

async function runMatchingFallback(
  ctx: RouterContext,
  state: NearbyState,
  pickup: { lat: number; lng: number },
  dropoff?: { lat: number; lng: number },
): Promise<boolean> {
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = requiredRadius(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;
  const role = state.mode === "drivers" ? "passenger" : "driver";

  let tempTripId: string | null = null;
  try {
    tempTripId = await insertTrip(ctx.supabase, {
      userId: ctx.profileId!,
      role,
      vehicleType: state.vehicle!,
      lat: pickup.lat,
      lng: pickup.lng,
      radiusMeters,
    });

    await logStructuredEvent("TRIP_CREATED", {
      tripId: tempTripId,
      role,
      vehicleType: state.vehicle,
      mode: state.mode,
      pickup: `${pickup.lat.toFixed(4)},${pickup.lng.toFixed(4)}`,
      radiusMeters,
      expiresIn: "90 min",
    });

    if (dropoff) {
      await updateTripDropoff(ctx.supabase, {
        tripId: tempTripId,
        lat: dropoff.lat,
        lng: dropoff.lng,
        radiusMeters,
      });
    }

    // Save intent to new table for better recommendations
    try {
      await saveIntent(ctx.supabase, {
        userId: ctx.profileId!,
        intentType: state.mode === "drivers" ? "nearby_drivers" : "nearby_passengers",
        vehicleType: state.vehicle!,
        pickup,
        dropoff,
        expiresInMinutes: 30,
      });
    } catch (intentError) {
      // Don't fail the search if intent saving fails
    }

    // Update state with myTripId so we can use it for matching later
    if (tempTripId) {
      await setState(ctx.supabase, ctx.profileId!, {
        key: "mobility_nearby_location",
        data: { ...state, pickup, dropoff, myTripId: tempTripId },
      });
    }

    // Log RPC call parameters for debugging
    await logStructuredEvent("MATCHES_CALL", {
      flow: "nearby",
      mode: state.mode,
      vehicle: state.vehicle,
      radius_m: radiusMeters,
      window_days: DEFAULT_WINDOW_DAYS,
      tripId: tempTripId,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      prefer_dropoff: Boolean(dropoff),
      max_results: max,
      wa_id: maskPhone(ctx.from),
      rpc_function: state.mode === "drivers" ? "match_drivers_for_trip_v2" : "match_passengers_for_trip_v2",
    });

    const matches: MatchResult[] = state.mode === "drivers"
      ? await matchDriversForTrip(
        ctx.supabase,
        tempTripId,
        max,
        Boolean(dropoff),
        radiusMeters,
        DEFAULT_WINDOW_DAYS,
      )
      : await matchPassengersForTrip(
        ctx.supabase,
        tempTripId,
        max,
        false,
        radiusMeters,
        DEFAULT_WINDOW_DAYS,
      );

    // Log detailed match results for debugging
    await logStructuredEvent("MATCHES_RESULT", {
      flow: "nearby",
      mode: state.mode,
      count: matches.length,
      tripId: tempTripId,
      searchedFor: state.mode, // "drivers" or "passengers"
      myRole: role, // opposite of mode
      // Include first 3 match IDs for debugging (if any)
      matchIds: matches.slice(0, 3).map(m => m.trip_id),
      matchDistances: matches.slice(0, 3).map(m => m.distance_km),
      matchAges: matches.slice(0, 3).map(m => m.location_age_minutes),
    });

    // Per requirement: Never send fallback error messages
    // Instead, proceed with database results (even if empty) and return to menu
    if (!matches.length) {
      // Log comprehensive debug info when no matches found
      await logStructuredEvent("NO_MATCHES_FOUND", {
        tripId: tempTripId,
        mode: state.mode,
        role,
        vehicle: state.vehicle,
        pickup: `${pickup.lat.toFixed(4)},${pickup.lng.toFixed(4)}`,
        radiusMeters,
        windowDays: DEFAULT_WINDOW_DAYS,
        possibleCauses: [
          "No active trips in area",
          "Vehicle type mismatch", 
          "Trips expired (>24h location age)",
          "Trips outside radius",
        ],
        hint: "Check mobility_trips table for open trips with role=driver/passenger",
      }, "warn");
      
      // Use specific message based on what user was searching for
      const messageKey = state.mode === "drivers" 
        ? "mobility.nearby.empty_results.drivers"  // User searched for drivers
        : "mobility.nearby.empty_results.passengers";  // User searched for passengers
      
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, messageKey),
        homeOnly(),
      );
      await clearState(ctx.supabase, ctx.profileId!);
      return true;
    }

  // NOTIFY DRIVERS (if searching for drivers)
  if (state.mode === "drivers") {
      // Get passenger name
      const { data: passenger } = await ctx.supabase
        .from("profiles")
        .select("full_name, whatsapp_number")
        .eq("user_id", ctx.profileId!)
        .single();
        
      const passengerName = passenger?.full_name ?? "A passenger";
      
      // Send notifications to top 9 drivers (async, don't block the user response)
      const notifyDrivers = async () => {
        for (const match of matches.slice(0, 9)) {
          if (!match.whatsapp_e164) continue;
          
          try {
            // Rate limiting: max 5 notifications per driver per hour
            // Query trip_notifications table (where notifications are actually stored)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count: recentNotifications } = await ctx.supabase
              .from('trip_notifications')
              .select('id', { count: 'exact', head: true })
              .eq('recipient_id', match.creator_user_id)
              .gte('created_at', oneHourAgo);
            
            if ((recentNotifications || 0) >= 5) {
              logStructuredEvent("DRIVER_NOTIFICATION_RATE_LIMITED", {
                driverId: match.creator_user_id,
                count: recentNotifications,
              });
              continue; // Skip this driver
            }
            
            // Quiet hours check
            const quiet = await isDriverQuiet(ctx.supabase, match.creator_user_id).catch(() => false);
            if (quiet) continue;
            
            const acceptId = `RIDE_ACCEPT::${tempTripId}`;
            
            try {
              await sendButtonsDirect(
                match.whatsapp_e164,
                ctx.locale,
                `🚖 **New Ride Request!**\n\nPassenger: ${passengerName}\nDistance: ${toDistanceLabel(match.distance_km)}\n\nDo you want to accept this ride?`,
                [{ id: acceptId, title: "✅ Accept Ride" }],
              );
            } catch {
              // Fallback to template/text if interactive fails
              try {
                const { sendTemplate } = await import("../wa/client.ts");
                const tpl = Deno.env.get('WA_DRIVER_NOTIFY_TEMPLATE') ?? 'ride_notify';
                const lang = Deno.env.get('WA_TEMPLATE_LANG') ?? 'en';
                const compact = `New ride near you. Passenger: ${passengerName}. ${toDistanceLabel(match.distance_km) ?? ''}`.trim();
                await sendTemplate(match.whatsapp_e164, { name: tpl, language: lang, bodyParameters: [{ type: 'text', text: compact }] });
              } catch {
                // Last resort - plain text
                await sendText(match.whatsapp_e164, `🚖 New ride near you. Passenger: ${passengerName}. Reply ACCEPT to confirm.`);
              }
            }
            
            // Log notification (don't await to avoid blocking)
            ctx.supabase.from("trip_notifications").insert({
              trip_id: tempTripId,
              recipient_id: match.creator_user_id,
              status: "sent"
            });
            
            // Log notification sent (fire and forget)
            logStructuredEvent("DRIVER_NOTIFIED", {
              tripId: tempTripId,
              driverId: match.creator_user_id,
            }).catch(() => {
              // Ignore logging errors
            });
          } catch (notifyError) {
            // Log error but continue with other drivers
            logStructuredEvent("DRIVER_NOTIFICATION_FAILED", {
              tripId: tempTripId,
              driverId: match.creator_user_id,
              error: notifyError instanceof Error ? notifyError.message : String(notifyError),
            });
          }
        }
      };
      
      // Fire and forget - don't block user response
      notifyDrivers().catch((_err: unknown) => {
        logStructuredEvent("DRIVER_NOTIFICATION_BATCH_FAILED", {
          tripId: tempTripId,
          error: _err instanceof Error ? _err.message : String(_err),
        });
      });
    }

    const rendered = sortMatches(matches, { prioritize: "distance" })
      .slice(0, 9)
      .map((match) => buildNearbyRow(ctx, match));

    await setState(ctx.supabase, ctx.profileId!, {
      key: "mobility_nearby_results",
      data: {
        mode: state.mode,
        vehicle: state.vehicle,
        rows: rendered.map((r) => r.state),
        coords: pickup,
      },
    });

    await sendListMessage(
      ctx,
      {
        title: state.mode === "drivers"
          ? t(ctx.locale, "mobility.nearby.list.title.drivers")
          : t(ctx.locale, "mobility.nearby.list.title.passengers"),
        body: state.mode === "drivers"
          ? t(ctx.locale, "mobility.nearby.list.body.drivers")
          : t(ctx.locale, "mobility.nearby.list.body.passengers"),
        sectionTitle: t(ctx.locale, "mobility.nearby.list.section"),
        rows: [
          ...rendered.map((r) => r.row),
          {
            id: IDS.BACK_MENU,
            title: t(ctx.locale, "common.menu_back"),
            description: t(ctx.locale, "common.back_to_menu.description"),
          },
        ],
        buttonText: t(ctx.locale, "common.buttons.open"),
      },
      { emoji: "📍" },
    );
    return true;
  } catch (error) {
    console.error("mobility.nearby_match_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "nearby",
      mode: state.mode,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "nearby",
      mode: state.mode,
      vehicle: state.vehicle,
      error: error instanceof Error ? error.message : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "mobility.nearby.error"),
      homeOnly(),
    );
    if (ctx.profileId) {
      await clearState(ctx.supabase, ctx.profileId);
    }
    return true;
  } finally {
    // CRITICAL FIX: Don't expire the trip immediately!
    // The trip should remain 'open' so it can be discovered by other users.
    // It will auto-expire via the expires_at column (default 30 min).
    // Benefits:
    // - Passenger trips stay visible when drivers search
    // - Driver trips stay visible when passengers search
    // - Enables true peer-to-peer discovery
  }
}

async function isDriverQuiet(client: any, driverId: string): Promise<boolean> {
  try {
    const { data } = await client
      .from('profiles')
      .select('metadata')
      .eq('user_id', driverId)
      .maybeSingle();
    const meta = (data?.metadata && typeof data.metadata === 'object') ? (data!.metadata as any) : {};
    const quiet = meta?.driver?.quiet;
    if (!quiet?.enabled) return false;
    const tz = quiet.tz || 'Africa/Kigali';
    const now = new Date();
    const hours = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(now);
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map((x: string) => parseInt(x, 10));
      return h * 60 + (m || 0);
    };
    const cur = toMinutes(hours);
    const start = toMinutes(String(quiet.start || '22:00'));
    const end = toMinutes(String(quiet.end || '06:00'));
    // Quiet window may cross midnight
    if (start <= end) {
      return cur >= start && cur < end;
    }
    return cur >= start || cur < end;
  } catch (_) {
    return false;
  }
}

function favoriteToRow(
  ctx: RouterContext,
  favorite: UserFavorite,
): { id: string; title: string; description?: string } {
  // Always use the address field if available (never show coordinates!)
  const description = favorite.address || "Location saved";
  return {
    id: `${SAVED_ROW_PREFIX}${favorite.id}`,
    title: `⭐ ${favorite.label}`,
    description,
  };
}

function parseFavoriteRowId(id: string): string | null {
  if (!id.startsWith(SAVED_ROW_PREFIX)) return null;
  return id.slice(SAVED_ROW_PREFIX.length);
}

function snapshotNearbyState(state: NearbyState): NearbySnapshot | null {
  if (!state.mode || !state.vehicle) return null;
  return {
    mode: state.mode,
    vehicle: state.vehicle,
    pickup: state.pickup ?? null,
  };
}
