import type { ButtonSpec, RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import { IDS } from "../../wa/ids.ts";
import {
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
  updateTripDropoff,
  updateTripLocation,
  recommendDriversForUser,
  recommendPassengersForUser,
  findScheduledTripsNearby,
} from "../../rpc/mobility.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../../flows/support.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { emitAlert } from "../../observe/alert.ts";
import { timeAgo } from "../../utils/text.ts";
import { sendText } from "../../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import {
  ensureVehiclePlate,
  getStoredVehicleType,
  updateStoredVehicleType,
} from "./vehicle_plate.ts";
import { getRecentNearbyIntent, storeNearbyIntent } from "./intent_cache.ts";
import { saveIntent, getRecentIntents } from "../../../_shared/wa-webhook-shared/domains/intent_storage.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { routeToAIAgent, sendAgentOptions } from "../ai-agents/index.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";
import { sortMatches } from "../../../_shared/wa-webhook-shared/utils/sortMatches.ts";

// Time window for matching: SQL function uses days
const DEFAULT_WINDOW_DAYS = 30;
// Per requirements: 10km radius consistently
const REQUIRED_RADIUS_METERS = 10_000;
// Search radius: read from app_config, default 15km (increased from 10km for 90%+ match rate)
const DEFAULT_RADIUS_METERS = 15_000;
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
  return Math.min(Math.max(meters, DEFAULT_RADIUS_METERS), DEFAULT_RADIUS_METERS);
}

function toDistanceLabel(distanceKm: unknown): string | null {
  const num = typeof distanceKm === "number" ? distanceKm : Number(distanceKm);
  if (!Number.isFinite(num)) return null;
  if (num >= 1) return `${num.toFixed(1)} km`;
  return `${Math.round(num * 1000)} m`;
}

function buildNearbyRow(
  ctx: RouterContext,
  match: MatchResult,
): {
  row: { id: string; title: string; description?: string };
  state: NearbyStateRow;
} {
  const masked = maskPhone(match.whatsapp_e164 ?? "");
  const distanceLabel = toDistanceLabel(match.distance_km);
  const seenLabel = timeAgo(
    getMatchTimestamp(match) ?? new Date().toISOString(),
  );
  
  // Show vehicle type prominently, especially if different from requested
  const vehicleLabel = match.vehicle_type 
    ? (match.is_exact_match === false 
        ? ` (${match.vehicle_type} 🚗)` 
        : ` • ${match.vehicle_type}`)
    : '';
  
  const descriptionParts = [
    t(ctx.locale, "mobility.nearby.row.ref", { ref: match.ref_code ?? "---" }),
  ];
  if (distanceLabel) {
    descriptionParts.push(
      t(ctx.locale, "mobility.nearby.row.distance", { distance: distanceLabel }),
    );
  }
  descriptionParts.push(
    t(ctx.locale, "mobility.nearby.row.seen", { time: seenLabel }),
  );
  const rowId = `MTCH::${match.trip_id}`;
  return {
    row: {
      id: rowId,
      title: `${masked}${vehicleLabel}`,
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

/**
 * Show recent searches as quick actions
 */
async function showRecentSearches(
  ctx: RouterContext,
  mode: "drivers" | "passengers",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  try {
    const intentType = mode === "drivers" ? "nearby_drivers" : "nearby_passengers";
    const recentIntents = await getRecentIntents(
      ctx.supabase,
      ctx.profileId,
      intentType as any,
      3,
    );
    
    if (!recentIntents?.length) {
      return false; // No recent searches
    }
    
    const rows = recentIntents.map((intent, i) => ({
      id: `RECENT::${i}::${intent.pickup_lat}::${intent.pickup_lng}::${intent.vehicle_type}`,
      title: `📍 ${timeAgo(new Date(intent.created_at))} - ${intent.vehicle_type}`,
      description: `${intent.pickup_lat.toFixed(4)}, ${intent.pickup_lng.toFixed(4)}`,
    }));
    
    await sendListMessage(ctx, {
      title: mode === "drivers" 
        ? t(ctx.locale, "mobility.nearby.recent_searches.title_drivers", { 
            defaultValue: "Recent Driver Searches" 
          })
        : t(ctx.locale, "mobility.nearby.recent_searches.title_passengers", { 
            defaultValue: "Recent Passenger Searches" 
          }),
      body: mode === "drivers"
        ? t(ctx.locale, "mobility.nearby.recent_searches.body_drivers", {
            defaultValue: "Search again from a recent location:",
          })
        : t(ctx.locale, "mobility.nearby.recent_searches.body_passengers", {
            defaultValue: "Search passengers from a recent location:",
          }),
      rows: [
        ...rows,
        { 
          id: IDS.SHARE_NEW_LOCATION, 
          title: t(ctx.locale, "mobility.nearby.share_new_location", {
            defaultValue: "📍 New Location",
          }),
        },
      ],
      buttonText: t(ctx.locale, "common.choose", { defaultValue: "Choose" }),
    });
    
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_recent",
      data: { mode, recentIntents },
    });
    
    return true;
  } catch (error) {
    console.error("Failed to show recent searches:", error);
    return false;
  }
}

export async function handleSeeDrivers(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Try to show recent searches first
  const showedRecent = await showRecentSearches(ctx, "drivers");
  if (showedRecent) {
    return true;
  }
  
  // Fall back to cached or vehicle selection
  try {
    const cached = await getRecentNearbyIntent(
      ctx.supabase,
      ctx.profileId,
      "drivers",
    );
    if (cached) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "mobility_nearby_location",
        data: { mode: "drivers", vehicle: cached.vehicle, pickup: null },
      });
      return await handleNearbyLocation(
        ctx,
        { mode: "drivers", vehicle: cached.vehicle },
        { lat: cached.lat, lng: cached.lng },
      );
    }
  } catch (error) {
    console.error("mobility.nearby_cache_read_fail", error);
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode: "drivers" },
  });
  await sendVehicleSelector(ctx, "drivers");
  return true;
}

export async function handleSeePassengers(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const ready = await ensureVehiclePlate(ctx, { type: "nearby_passengers" });
  if (!ready) return true;

  try {
    const cached = await getRecentNearbyIntent(
      ctx.supabase,
      ctx.profileId,
      "passengers",
    );
    if (cached) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "mobility_nearby_location",
        data: { mode: "passengers", vehicle: cached.vehicle },
      });
      return await handleNearbyLocation(
        ctx,
        { mode: "passengers", vehicle: cached.vehicle },
        { lat: cached.lat, lng: cached.lng },
      );
    }
  } catch (error) {
    console.error("mobility.nearby_cache_read_fail", error);
  }

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
  
  // Handle recent search selection
  if (id.startsWith("RECENT::")) {
    const parts = id.split("::");
    if (parts.length === 5) {
      const [, index, lat, lng, vehicle] = parts;
      const pickup = { lat: parseFloat(lat), lng: parseFloat(lng) };
      
      await setState(ctx.supabase, ctx.profileId, {
        key: "mobility_nearby_location",
        data: { mode: state.mode, vehicle, pickup },
      });
      
      return await handleNearbyLocation(
        ctx,
        { mode: state.mode, vehicle },
        pickup,
      );
    }
  }
  
  const vehicleType = vehicleFromId(id);
  if (state.mode === "passengers") {
    await updateStoredVehicleType(ctx.supabase, ctx.profileId, vehicleType);
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_location",
    data: { mode: state.mode, vehicle: vehicleType },
  });
  await promptShareLocation(ctx, { mode: state.mode, vehicle: vehicleType }, {
    allowVehicleChange: state.mode === "passengers",
  });
  return true;
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
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_location",
      data: updatedState,
    });
  }

  try {
    await storeNearbyIntent(ctx.supabase, ctx.profileId, state.mode, {
      vehicle: state.vehicle,
      lat: pickup.lat,
      lng: pickup.lng,
    });
  } catch (error) {
    console.error("mobility.nearby_cache_write_fail", error);
  }

  /* AI AGENT DISABLED FOR PHASE 1 - Direct database matching only
     AI agents will be enabled in Phase 2 for enhanced driver/passenger matching
  
  if (
    state.mode === "drivers" &&
    dropoff &&
    isFeatureEnabled("agent.nearby_drivers")
  ) {
    await sendText(ctx.from, t(ctx.locale, "mobility.nearby.agent_search"));
    try {
      const agentResponse = await routeToAIAgent(ctx, {
        userId: ctx.from,
        agentType: "nearby_drivers",
        flowType: "find_driver",
        requestData: {
          pickup: { latitude: pickup.lat, longitude: pickup.lng },
          dropoff: { latitude: dropoff.lat, longitude: dropoff.lng },
          vehicleType: state.vehicle,
          maxPrice: null,
        },
      });

      if (agentResponse.success && agentResponse.options) {
        await sendAgentOptions(
          ctx,
          agentResponse.sessionId,
          agentResponse.options,
          t(ctx.locale, "mobility.nearby.agent_results"),
        );

        await setState(ctx.supabase, ctx.profileId, {
          key: "ai_agent_selection",
          data: {
            sessionId: agentResponse.sessionId,
            agentType: "nearby_drivers",
          },
        });
        return true;
      }

      await sendText(
        ctx.from,
        agentResponse.message ??
          t(ctx.locale, "mobility.nearby.agent_empty"),
      );
    } catch (error) {
      console.error("mobility.nearby_agent_fail", error);
      await sendText(ctx.from, t(ctx.locale, "mobility.nearby.agent_error"));
    }
  }
  */

  // DIRECT DATABASE MATCHING: Simple workflow for Phase 1
  // User shares location → Instant database query → Top 9 results
  return await runMatchingFallback(ctx, updatedState, pickup);
}

export async function handleNearbyResultSelection(
  ctx: RouterContext,
  state: NearbyState,
  id: string,
): Promise<boolean> {
  if (!state.rows || !ctx.profileId) return false;
  const match = state.rows.find((row) => row.id === id);
  if (!match) return false;
  await logStructuredEvent("MATCH_SELECTION", {
    flow: "nearby",
    trip_id: match.tripId,
    mode: state.mode,
  });
  const prefilledMessage = state.mode === "drivers"
    ? t(ctx.locale, "mobility.nearby.prefill.driver")
    : t(ctx.locale, "mobility.nearby.prefill.passenger");
  const link = waChatLink(match.whatsapp, prefilledMessage);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "mobility.nearby.chat_cta", { link }),
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
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
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.list.title"),
      body,
      sectionTitle: t(ctx.locale, "location.saved.list.section"),
      rows: [
        ...favorites.map((favorite) => favoriteToRow(ctx, favorite)),
        ...buildSaveRows(ctx),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
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
}

async function promptShareLocation(
  ctx: RouterContext,
  state: NearbyState,
  options: { allowVehicleChange?: boolean } = {},
): Promise<void> {
  const buttons: ButtonSpec[] = [];
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
  const instructions = t(ctx.locale, "location.share.instructions");
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "mobility.nearby.share_location", { instructions }),
    buttons,
  );
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
      console.error("Failed to save intent:", intentError);
    }

    await logStructuredEvent("MATCHES_CALL", {
      flow: "nearby",
      mode: state.mode,
      vehicle: state.vehicle,
      radius_m: radiusMeters,
      wa_id: maskPhone(ctx.from),
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

    await logStructuredEvent("MATCHES_RESULT", {
      flow: "nearby",
      mode: state.mode,
      count: matches.length,
    });

    // ENHANCEMENT: Add recommendations and scheduled trips for better discovery
    let enhancedMatches = [...matches];
    
    // If we have few live matches, add recommendations
    if (matches.length < 5 && ctx.profileId) {
      try {
        const recommendations = state.mode === "drivers"
          ? await recommendDriversForUser(ctx.supabase, ctx.profileId, 3)
          : await recommendPassengersForUser(ctx.supabase, ctx.profileId, 3);
        
        // Convert recommendations to MatchResult format
        const recMatches: MatchResult[] = recommendations.map((rec) => ({
          trip_id: `rec_${rec.driver_user_id ?? rec.passenger_user_id}`,
          creator_user_id: rec.driver_user_id ?? rec.passenger_user_id ?? "",
          whatsapp_e164: rec.whatsapp_e164,
          ref_code: "★ Recommended",
          distance_km: rec.distance_km,
          drop_bonus_m: null,
          pickup_text: `⭐ ${rec.vehicle_type} (often nearby)`,
          dropoff_text: null,
          matched_at: rec.last_online_at ?? rec.last_search_at ?? null,
          created_at: rec.last_online_at ?? rec.last_search_at ?? null,
        }));
        
        enhancedMatches = [...matches, ...recMatches];
        
        if (recMatches.length > 0) {
          await logStructuredEvent("RECOMMENDATIONS_ADDED", {
            flow: "nearby",
            mode: state.mode,
            count: recMatches.length,
          });
        }
      } catch (error) {
        console.error("Failed to get recommendations:", error);
        // Don't fail the search if recommendations fail
      }
    }

    // Add scheduled trips if searching for drivers
    if (state.mode === "drivers" && enhancedMatches.length < 7) {
      try {
        const scheduled = await findScheduledTripsNearby(
          ctx.supabase,
          pickup.lat,
          pickup.lng,
          10,
          state.vehicle,
          24,
        );
        
        // Convert scheduled trips to MatchResult format
        const scheduledMatches: MatchResult[] = scheduled
          .filter(s => s.role === "driver")
          .map((trip) => ({
            trip_id: trip.trip_id,
            creator_user_id: trip.creator_user_id,
            whatsapp_e164: trip.whatsapp_e164,
            ref_code: "📅 Scheduled",
            distance_km: trip.distance_km,
            drop_bonus_m: null,
            pickup_text: `📅 ${new Date(trip.scheduled_at).toLocaleString("en-RW", { 
              hour: "2-digit", 
              minute: "2-digit",
              weekday: "short"
            })}`,
            dropoff_text: trip.dropoff_text,
            matched_at: trip.scheduled_at,
            created_at: trip.created_at,
          }));
        
        enhancedMatches = [...enhancedMatches, ...scheduledMatches];
        
        if (scheduledMatches.length > 0) {
          await logStructuredEvent("SCHEDULED_TRIPS_ADDED", {
            flow: "nearby",
            count: scheduledMatches.length,
          });
        }
      } catch (error) {
        console.error("Failed to get scheduled trips:", error);
      }
    }

    // Per requirement: Never send fallback error messages
    // Instead, proceed with database results (even if empty) and return to menu
    if (!enhancedMatches.length) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "mobility.nearby.empty_results"),
        homeOnly(),
      );
      await clearState(ctx.supabase, ctx.profileId!);
      return true;
    }

    const rendered = sortMatches(enhancedMatches, { prioritize: "distance" })
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
    // Removing this allows:
    // - Passenger trips to be visible when drivers search
    // - Driver trips to be visible when passengers search
  }
}

function favoriteToRow(
  ctx: RouterContext,
  favorite: UserFavorite,
): { id: string; title: string; description?: string } {
  const description = favorite.address
    ? favorite.address
    : `${favorite.lat.toFixed(4)}, ${favorite.lng.toFixed(4)}`;
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
