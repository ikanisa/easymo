import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import {
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
} from "../../rpc/mobility.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../../flows/support.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { emitAlert } from "../../observe/alert.ts";
import { timeAgo } from "../../utils/text.ts";
import {
  buildButtons,
  ButtonSpec,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";

const DEFAULT_WINDOW_DAYS = 30;
const MIN_RADIUS_METERS = 1000;

export const VEHICLE_OPTIONS: Array<{
  id: string;
  title: string;
  description: string;
}> = [
  {
    id: "veh_moto",
    title: "Moto taxi",
    description: "Two-wheel rides around town.",
  },
  {
    id: "veh_cab",
    title: "Cab",
    description: "Standard car trips.",
  },
  {
    id: "veh_lifan",
    title: "Lifan",
    description: "Three-wheel cargo rides.",
  },
  {
    id: "veh_truck",
    title: "Truck",
    description: "Pickup or truck deliveries.",
  },
  {
    id: "veh_others",
    title: "Other vehicles",
    description: "Anything else (buses, vans, etc.).",
  },
];

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
  rows?: NearbyStateRow[];
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

function kmToMeters(km: number | null | undefined): number {
  if (!km || Number.isNaN(km)) return MIN_RADIUS_METERS;
  return Math.max(Math.round(km * 1000), MIN_RADIUS_METERS);
}

function toDistanceLabel(distanceKm: unknown): string | null {
  const num = typeof distanceKm === "number" ? distanceKm : Number(distanceKm);
  if (!Number.isFinite(num)) return null;
  if (num >= 1) return `${num.toFixed(1)} km`;
  return `${Math.round(num * 1000)} m`;
}

function buildNearbyRow(
  match: MatchResult,
  mode: NearbyMode,
): {
  row: { id: string; title: string; description?: string };
  state: NearbyStateRow;
} {
  const masked = maskPhone(match.whatsapp_e164 ?? "");
  const distanceLabel = toDistanceLabel(match.distance_km);
  const seenLabel = timeAgo(
    getMatchTimestamp(match) ?? new Date().toISOString(),
  );
  const parts = [`Ref ${match.ref_code ?? "---"}`];
  if (distanceLabel) parts.push(distanceLabel);
  parts.push(`Seen ${seenLabel}`);
  const description = parts.join(" • ");
  const rowId = `MTCH::${match.trip_id}`;
  return {
    row: {
      id: rowId,
      title: masked,
      description,
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
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode: "drivers" },
  });
  await sendVehicleSelector(ctx, "🚖 Nearby drivers");
  return true;
}

export async function handleSeePassengers(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_select",
    data: { mode: "passengers" },
  });
  await sendVehicleSelector(ctx, "🧍‍♀️ Nearby passengers");
  return true;
}

export async function handleVehicleSelection(
  ctx: RouterContext,
  state: NearbyState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const vehicleType = vehicleFromId(id);
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_location",
    data: { mode: state.mode, vehicle: vehicleType },
  });
  await promptShareLocation(ctx);
  return true;
}

export async function handleNearbyLocation(
  ctx: RouterContext,
  state: NearbyState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.vehicle || !state.mode) return false;
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;
  const role = state.mode === "drivers" ? "passenger" : "driver";

  let tempTripId: string | null = null;
  try {
    tempTripId = await insertTrip(ctx.supabase, {
      userId: ctx.profileId,
      role,
      vehicleType: state.vehicle,
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
    });

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
        false,
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

    if (!matches.length) {
      await sendButtonsMessage(
        ctx,
        state.mode === "drivers"
          ? "No drivers nearby right now. Try again in a few minutes."
          : "No passengers nearby right now. Try again in a few minutes.",
        homeOnly(),
      );
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      return true;
    }

    const rendered = matches
      .sort(sortMatches)
      .slice(0, 9)
      .map((match) => buildNearbyRow(match, state.mode));
    await logStructuredEvent("MATCH_OPTIONS", {
      flow: "nearby",
      mode: state.mode,
      renderedOptions: rendered.length,
    });

    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_results",
      data: {
        mode: state.mode,
        vehicle: state.vehicle,
        rows: rendered.map((r) => r.state),
        coords,
      },
    });

    const listBody = state.mode === "drivers"
      ? "Tap a driver to open WhatsApp chat."
      : "Tap a passenger to open WhatsApp chat.";
    await sendListMessage(
      ctx,
      {
        title: state.mode === "drivers"
          ? "🚖 Drivers nearby"
          : "🧍‍♂️ Passengers nearby",
        body: listBody,
        sectionTitle: state.mode === "drivers" ? "Drivers" : "Passengers",
        rows: [
          ...rendered.map((r) => r.row),
          {
            id: IDS.BACK_MENU,
            title: "← Back",
            description: "Return to the main menu.",
          },
        ],
        buttonText: "View",
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
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      "⚠️ Matching service is unavailable right now. Please try again shortly.",
      homeOnly(),
    );
    if (ctx.profileId) {
      await clearState(ctx.supabase, ctx.profileId);
    }
    return true;
  } finally {
    if (tempTripId) {
      await ctx.supabase.from("trips").update({ status: "expired" }).eq(
        "id",
        tempTripId,
      );
    }
  }
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
  const link = waChatLink(match.whatsapp, `Hi, I'm Ref ${match.ref}`);
  await sendButtonsMessage(
    ctx,
    `Chat on WhatsApp: ${link}`,
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

export function isVehicleOption(id: string): boolean {
  return VEHICLE_OPTIONS.some((opt) => opt.id === id);
}

async function sendVehicleSelector(ctx: RouterContext, title: string) {
  const rows = [
    ...VEHICLE_OPTIONS,
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "Return to the main menu.",
    },
  ];
  await sendListMessage(
    ctx,
    {
      title,
      body: "Pick a vehicle type to continue.",
      sectionTitle: "Vehicle",
      rows,
      buttonText: "Select",
    },
    { emoji: title.includes("drivers") ? "🚖" : "🧭" },
  );
}

async function promptShareLocation(ctx: RouterContext): Promise<void> {
  await sendButtonsMessage(
    ctx,
    "📍 Share your live location (tap ➕ → Location → Share).",
    [],
  );
}

function sortMatches(a: MatchResult, b: MatchResult): number {
  const timeA = timestampMs(a);
  const timeB = timestampMs(b);
  if (timeB !== timeA) return timeB - timeA;
  const distA = typeof a.distance_km === "number"
    ? a.distance_km
    : Number.MAX_SAFE_INTEGER;
  const distB = typeof b.distance_km === "number"
    ? b.distance_km
    : Number.MAX_SAFE_INTEGER;
  return distA - distB;
}
