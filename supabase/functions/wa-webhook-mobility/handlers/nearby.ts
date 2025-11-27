import type { ButtonSpec, RouterContext } from "../types.ts";
import { clearState, setState } from "../state/store.ts";
import { t } from "../i18n/translator.ts";
import { IDS } from "../wa/ids.ts";
import {
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
  updateTripDropoff,
} from "../rpc/mobility.ts";
import { getAppConfig } from "../utils/app_config.ts";
import { waChatLink } from "../utils/links.ts";
import { maskPhone } from "../flows/support.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { emitAlert } from "../observe/alert.ts";
import { timeAgo } from "../utils/text.ts";
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
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { routeToAIAgent, sendAgentOptions } from "../ai-agents/index.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";
import { checkLocationCache } from "./location_cache.ts";
import { readLastLocation } from "../locations/favorites.ts";

const DEFAULT_WINDOW_DAYS = 30;
const REQUIRED_RADIUS_METERS = 10_000;
const MAX_RADIUS_METERS = 25_000;
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
  if (!Number.isFinite(configRadiusKm ?? NaN)) return REQUIRED_RADIUS_METERS;
  const meters = Math.round(Number(configRadiusKm) * 1000);
  if (!Number.isFinite(meters) || meters <= 0) return REQUIRED_RADIUS_METERS;
  return Math.min(
    Math.max(meters, REQUIRED_RADIUS_METERS),
    MAX_RADIUS_METERS,
  );
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
      title: masked,
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

export async function handleSeeDrivers(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // 1. Check for cached location (30 min window)
  const last = await readLastLocation(ctx);
  const cacheCheck = checkLocationCache(last?.capturedAt ?? null);
  if (!cacheCheck.needsRefresh && last) {
    const { lat, lng } = last;
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_location",
      data: { mode: "drivers", vehicle: "veh_moto", pickup: { lat, lng } },
    });
    const cachedIntent = await getRecentNearbyIntent(ctx.supabase, ctx.profileId, "drivers");
    const vehicle = cachedIntent?.vehicle ?? "veh_moto";
    return await handleNearbyLocation(ctx, { mode: "drivers", vehicle }, { lat, lng });
  }

  // Fallback to asking for location
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

  // 1. Check for cached location (30 min window)
  const last2 = await readLastLocation(ctx);
  const cacheCheck2 = checkLocationCache(last2?.capturedAt ?? null);
  if (!cacheCheck2.needsRefresh && last2) {
    const { lat, lng } = last2;
    const storedVehicle = await getStoredVehicleType(ctx.supabase, ctx.profileId) ?? "veh_moto";
    return await handleNearbyLocation(ctx, { mode: "passengers", vehicle: storedVehicle }, { lat, lng });
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

export async function handleNearbyRecent(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    // Prefer last drivers intent; fallback to passengers
    const drivers = await getRecentNearbyIntent(ctx.supabase, ctx.profileId, 'drivers');
    const passengers = await getRecentNearbyIntent(ctx.supabase, ctx.profileId, 'passengers');
    const pick = drivers || passengers;
    if (!pick) {
      await sendButtonsMessage(ctx, 'No recent search found. Pick a mode.', buildButtons(
        { id: IDS.SEE_DRIVERS, title: 'Drivers' },
        { id: IDS.SEE_PASSENGERS, title: 'Passengers' },
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
    await sendButtonsMessage(ctx, 'Could not load your recent search.', buildButtons({ id: IDS.BACK_MENU, title: 'Back' }));
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
  const body = t(ctx.locale, "mobility.nearby.share_location", { instructions });
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

    if (dropoff) {
      await updateTripDropoff(ctx.supabase, {
        tripId: tempTripId,
        lat: dropoff.lat,
        lng: dropoff.lng,
        radiusMeters,
      });
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

    // Per requirement: Never send fallback error messages
    // Instead, proceed with database results (even if empty) and return to menu
    if (!matches.length) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "mobility.nearby.empty_results"),
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
      
      // Send notifications to top 9 drivers
      for (const match of matches.slice(0, 9)) {
        if (match.whatsapp_e164) {
            // Quiet hours check
            const quiet = await isDriverQuiet(ctx.supabase, match.creator_user_id).catch(() => false);
            if (quiet) continue;
             // Create accept link/button payload
             // For now, we use a simple text message with a button if possible, or just text
             // Since we can't easily send buttons outside 24h window without template, 
             // we will use a text message with a clear instruction or link if applicable.
             // But here we are in the webhook, so we might be able to send buttons if the driver messaged recently.
             // To be safe and robust, we'll send a text message with a "Reply ACCEPT" instruction or similar,
             // OR better, we use the new "Accept Ride" button flow if we assume drivers are active.
             
             // We will send a template-like message.
             const acceptId = `RIDE_ACCEPT::${tempTripId}`;
             try {
               await sendButtonsDirect(
                 match.whatsapp_e164,
                 ctx.locale,
                 `🚖 **New Ride Request!**\n\nPassenger: ${passengerName}\nDistance: ${toDistanceLabel(match.distance_km)}\n\nDo you want to accept this ride?`,
                 [{ id: acceptId, title: "✅ Accept Ride" }],
               );
             } catch (e) {
               // Fallback to template/text if interactive fails
               try {
                 const { sendTemplate } = await import("../../wa/client.ts");
                 const tpl = Deno.env.get('WA_DRIVER_NOTIFY_TEMPLATE') ?? 'ride_notify';
                 const lang = Deno.env.get('WA_TEMPLATE_LANG') ?? 'en';
                 const compact = `New ride near you. Passenger: ${passengerName}. ${toDistanceLabel(match.distance_km) ?? ''}`.trim();
                 await sendTemplate(match.whatsapp_e164, { name: tpl, language: lang, bodyParameters: [{ type: 'text', text: compact }] });
               } catch (tplErr) {
                 const { sendText } = await import("../../wa/client.ts");
                 await sendText(match.whatsapp_e164, `🚖 New ride near you. Passenger: ${passengerName}. Reply ACCEPT to confirm.`);
               }
             }
             
             // Log notification
             await ctx.supabase.from("ride_notifications").insert({
               trip_id: tempTripId,
               driver_id: match.creator_user_id,
               status: "sent"
             });
        }
      }
    }

    const rendered = matches
      .sort(sortMatches)
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
    // Keep trip open for a bit if we notified drivers, otherwise expire
    // If we notified drivers, we want the trip to stay 'open' so they can accept it.
    // The migration sets default status to 'open'.
    // We should ONLY expire if no matches found or if it was a passenger search (maybe).
    // For now, let's keep it open for 10 mins if drivers were notified.
    
    if (state.mode !== "drivers") {
        if (tempTripId) {
          await ctx.supabase.from("rides_trips").update({ status: "expired" }).eq(
            "id",
            tempTripId,
          );
        }
    }
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

function sortMatches(a: MatchResult, b: MatchResult): number {
  const distA = typeof a.distance_km === "number"
    ? a.distance_km
    : Number.MAX_SAFE_INTEGER;
  const distB = typeof b.distance_km === "number"
    ? b.distance_km
    : Number.MAX_SAFE_INTEGER;
  if (distA !== distB) return distA - distB;
  const timeA = timestampMs(a);
  const timeB = timestampMs(b);
  if (timeB !== timeA) return timeB - timeA;
  return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
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
