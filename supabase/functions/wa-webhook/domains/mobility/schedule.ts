import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { VEHICLE_OPTIONS, vehicleFromId } from "./nearby.ts";
import {
  gateProFeature,
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
  updateTripDropoff,
} from "../../rpc/mobility.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../../flows/support.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { timeAgo } from "../../utils/text.ts";
import { sendText } from "../../wa/client.ts";
import {
  buildButtons,
  ButtonSpec,
  sendButtonsMessage,
  sendListMessage,
  sendListWithActions,
} from "../../utils/reply.ts";
import { emitAlert } from "../../observe/alert.ts";
import {
  ensureVehiclePlate,
  getStoredVehicleType,
  updateStoredVehicleType,
} from "./vehicle_plate.ts";

const ROLE_ROWS = [
  {
    id: IDS.ROLE_PASSENGER,
    title: "Start as passenger",
    description: "Find drivers for your trip.",
  },
  {
    id: IDS.ROLE_DRIVER,
    title: "Start as driver",
    description: "Match with passengers on your route.",
  },
  {
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to the main menu.",
  },
];

const DEFAULT_WINDOW_DAYS = 30;
const MIN_RADIUS_METERS = 1000;

interface ScheduleState {
  role?: "driver" | "passenger";
  vehicle?: string;
  tripId?: string;
  origin?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number } | null;
  rows?: ScheduleRow[];
}

interface ScheduleRow {
  id: string;
  whatsapp: string;
  ref: string;
  tripId: string;
}

function getMatchTimestamp(match: MatchResult): string | null {
  return match.matched_at ?? match.created_at ?? null;
}

function timestampMs(match: MatchResult): number {
  const ts = getMatchTimestamp(match);
  return ts ? Date.parse(ts) : 0;
}

export async function startScheduleTrip(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_role",
    data: {},
  });
  await sendListMessage(
    ctx,
    {
      title: "🚦 Schedule a trip",
      body: "Choose how you want to ride today.",
      sectionTitle: "Role",
      buttonText: "View",
      rows: ROLE_ROWS,
    },
    { emoji: "🚦" },
  );
  return true;
}

export async function handleScheduleRole(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const role = id === IDS.ROLE_DRIVER
    ? "driver"
    : id === IDS.ROLE_PASSENGER
    ? "passenger"
    : null;
  if (!role) return false;
  if (role === "driver") {
    const ready = await ensureVehiclePlate(ctx, {
      type: "schedule_role",
      roleId: id,
    });
    if (!ready) return true;
    const storedVehicle = await getStoredVehicleType(
      ctx.supabase,
      ctx.profileId,
    );
    if (storedVehicle) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "schedule_location",
        data: { role, vehicle: storedVehicle },
      });
      await sendButtonsMessage(
        ctx,
        "📍 Share pickup location (tap ➕ → Location → Share).",
        sharePickupButtons(role, { allowChange: true }),
      );
      return true;
    }
  }
  await promptScheduleVehicleSelection(ctx, role);
  return true;
}

export async function handleScheduleSkipDropoff(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle || !state.origin) {
    return false;
  }
  return await createTripAndDeliverMatches(ctx, state, { dropoff: null });
}

export async function handleScheduleVehicle(
  ctx: RouterContext,
  state: ScheduleState,
  vehicleId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.role) return false;
  const vehicleType = vehicleFromId(vehicleId);
  if (state.role === "driver") {
    await updateStoredVehicleType(ctx.supabase, ctx.profileId, vehicleType);
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_location",
    data: {
      role: state.role,
      vehicle: vehicleType,
    },
  });
  await sendButtonsMessage(
    ctx,
    "📍 Share pickup location (tap ➕ → Location → Share).",
    sharePickupButtons(state.role, {
      allowChange: state.role === "driver",
    }),
  );
  return true;
}

export async function handleScheduleChangeVehicle(
  ctx: RouterContext,
  data: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const roleValue = typeof data?.role === "string" ? data.role : null;
  const role = roleValue === "driver"
    ? "driver"
    : roleValue === "passenger"
    ? "passenger"
    : null;
  if (!role) return false;
  await promptScheduleVehicleSelection(ctx, role);
  return true;
}

export async function handleScheduleLocation(
  ctx: RouterContext,
  state: ScheduleState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_dropoff",
    data: {
      role: state.role,
      vehicle: state.vehicle,
      origin: coords,
    },
  });

  await sendButtonsMessage(
    ctx,
    "📍 Share drop-off location (optional).",
    buildButtons(
      { id: IDS.SCHEDULE_SKIP_DROPOFF, title: "Skip" },
      { id: IDS.BACK_MENU, title: "↩️ Menu" },
    ),
  );
  return true;
}

export async function handleScheduleDropoff(
  ctx: RouterContext,
  state: ScheduleState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) {
    return false;
  }
  if (!state.tripId) {
    await createTripAndDeliverMatches(ctx, {
      role: state.role,
      vehicle: state.vehicle,
      origin: state.origin,
    }, {
      dropoff: coords,
    });
    return true;
  }
  try {
    await updateTripDropoff(ctx.supabase, {
      tripId: state.tripId,
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters: undefined,
    });

    const context: ScheduleState = {
      ...state,
      dropoff: coords,
    };

    const config = await getAppConfig(ctx.supabase);
    const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
    const max = config.max_results ?? 9;

    const matches = await fetchMatches(ctx, context, {
      preferDropoff: true,
      limit: max,
      radiusMeters,
    });

    await deliverMatches(ctx, context, matches, {
      messagePrefix: "Drop-off saved!",
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_dropoff_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage: "dropoff",
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage: "dropoff",
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't refresh matches right now. Try again later.",
      shareDropoffButtons(),
    );
    return true;
  }
}

export async function handleScheduleRefresh(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (
    !ctx.profileId || !state.tripId || !state.role || !state.vehicle ||
    !state.origin
  ) {
    return false;
  }
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;

  try {
    const matches = await fetchMatches(ctx, state, {
      preferDropoff: Boolean(state.dropoff),
      limit: max,
      radiusMeters,
    });

    await deliverMatches(ctx, state, matches, {
      messagePrefix: "🔄 Latest matches",
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_refresh_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage: "refresh",
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage: "refresh",
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't refresh matches right now. Please try again shortly.",
      matchActionButtons(state),
    );
    return true;
  }
}

export async function requestScheduleDropoff(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) {
    return false;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_dropoff",
    data: { ...state },
  });
  await sendButtonsMessage(
    ctx,
    "📍 Share drop-off location (tap ➕ → Location). It’s optional—tap Skip if you’re not sure.",
    shareDropoffButtons(),
  );
  return true;
}

async function createTripAndDeliverMatches(
  ctx: RouterContext,
  state: ScheduleState,
  options: { dropoff: { lat: number; lng: number } | null },
): Promise<boolean> {
  if (!state.origin) throw new Error("Missing pickup location");
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;
  let tripId: string | null = null;
  const stage = options.dropoff ? "dropoff" : "origin";

  try {
    tripId = await insertTrip(ctx.supabase, {
      userId: ctx.profileId!,
      role: state.role!,
      vehicleType: state.vehicle!,
      lat: state.origin.lat,
      lng: state.origin.lng,
      radiusMeters,
    });

    if (options.dropoff) {
      await updateTripDropoff(ctx.supabase, {
        tripId,
        lat: options.dropoff.lat,
        lng: options.dropoff.lng,
        radiusMeters: undefined,
      });
    }

    const context: ScheduleState = {
      role: state.role,
      vehicle: state.vehicle,
      tripId,
      origin: state.origin,
      dropoff: options.dropoff,
    };

    const matches = await fetchMatches(ctx, context, {
      preferDropoff: Boolean(options.dropoff),
      limit: max,
      radiusMeters,
    });

    await deliverMatches(ctx, context, matches, {
      messagePrefix: "Trip created!",
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_create_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage,
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage,
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    if (tripId) {
      const followUp = [
        "✅ Trip saved!",
        "We didn't find live matches yet, but your trip is now visible to nearby riders.",
        "You can explore nearby options anytime from the menu.",
      ].join("\n");

      const browseButton: ButtonSpec = state.role === "passenger"
        ? { id: IDS.SEE_DRIVERS, title: "🚗 Nearby drivers" }
        : { id: IDS.SEE_PASSENGERS, title: "🧍 Nearby passengers" };

      await sendButtonsMessage(
        ctx,
        followUp,
        [browseButton, { id: IDS.BACK_MENU, title: "↩️ Menu" }],
      );
    } else {
      await sendButtonsMessage(
        ctx,
        "⚠️ Matching service is unavailable right now. Please try again in a few minutes.",
        buildButtons({ id: IDS.BACK_MENU, title: "↩️ Menu" }),
      );
    }

    await clearState(ctx.supabase, ctx.profileId!);
    return true;
  }
}

export async function handleScheduleResultSelection(
  ctx: RouterContext,
  state: ScheduleState,
  id: string,
): Promise<boolean> {
  if (!state.rows || !ctx.profileId) return false;
  const match = state.rows.find((row) => row.id === id);
  if (!match) return false;
  await logStructuredEvent("MATCH_SELECTION", {
    flow: "schedule",
    role: state.role,
    trip_id: state.tripId ?? null,
    selected_trip_id: match.tripId,
  });
  const link = waChatLink(match.whatsapp, `Hi, I'm Ref ${match.ref}`);
  await sendButtonsMessage(
    ctx,
    `Open WhatsApp chat: ${link}`,
    [
      { id: IDS.SCHEDULE_REFRESH_RESULTS, title: "🔄 Refresh" },
    ],
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

export function isScheduleRole(id: string): boolean {
  return id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER;
}

export function isScheduleResult(id: string): boolean {
  return id.startsWith("MTCH::");
}

function sharePickupButtons(
  role?: "driver" | "passenger",
  options: { allowChange?: boolean } = {},
): ButtonSpec[] {
  if (role === "driver" && options.allowChange) {
    return buildButtons(
      { id: IDS.MOBILITY_CHANGE_VEHICLE, title: "Change vehicle" },
    );
  }
  return [];
}

async function promptScheduleVehicleSelection(
  ctx: RouterContext,
  role: "driver" | "passenger",
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_vehicle",
    data: { role },
  });
  await sendListWithActions(
    ctx,
    {
      title: role === "driver"
        ? "🚗 You are a driver"
        : "🧍 You are a passenger",
      body: "Choose your vehicle type.",
      sectionTitle: "Vehicle",
      rows: VEHICLE_OPTIONS,
      buttonText: "Select",
    },
    sharePickupButtons(role),
  );
}

function shareDropoffButtons(): ButtonSpec[] {
  return [
    { id: IDS.SCHEDULE_SKIP_DROPOFF, title: "Skip" },
    { id: IDS.SCHEDULE_ADD_DROPOFF, title: "➕ Add drop-off" },
  ];
}

function kmToMeters(km: number | null | undefined): number {
  if (!km || Number.isNaN(km)) return MIN_RADIUS_METERS;
  return Math.max(Math.round(km * 1000), MIN_RADIUS_METERS);
}

async function fetchMatches(
  ctx: RouterContext,
  state: ScheduleState,
  options: {
    preferDropoff: boolean;
    limit: number;
    radiusMeters: number;
  },
): Promise<MatchResult[]> {
  const matches = state.role === "passenger"
    ? await matchDriversForTrip(
      ctx.supabase,
      state.tripId!,
      options.limit,
      options.preferDropoff,
      options.radiusMeters,
      DEFAULT_WINDOW_DAYS,
    )
    : await matchPassengersForTrip(
      ctx.supabase,
      state.tripId!,
      options.limit,
      options.preferDropoff,
      options.radiusMeters,
      DEFAULT_WINDOW_DAYS,
    );
  return matches.sort(sortMatches).slice(0, 9);
}

async function deliverMatches(
  ctx: RouterContext,
  state: ScheduleState,
  matches: MatchResult[],
  meta: { messagePrefix: string; radiusMeters: number },
): Promise<void> {
  await logStructuredEvent("MATCHES_RESULT", {
    flow: "schedule",
    role: state.role,
    trip_id: state.tripId,
    count: matches.length,
  });

  const rows = matches.map((match) => buildScheduleRow(match));

  await setState(ctx.supabase, ctx.profileId!, {
    key: "schedule_results",
    data: {
      ...state,
      rows: rows.map((r) => r.state),
    },
  });

  const body = matches.length
    ? `${meta.messagePrefix}\nTap a match to open chat.`
    : `${meta.messagePrefix}\nNo matches yet. We’ll keep looking.`;

  if (!matches.length) {
    await sendText(
      ctx.from,
      `${body}\nWe\'ll keep looking and update you soon.`,
    );
    return;
  }

  await sendListWithActions(
    ctx,
    {
      title: state.role === "passenger"
        ? "🚗 Available drivers"
        : "🧍 Nearby passengers",
      body,
      sectionTitle: "Matches",
      rows: rows.map((r) => r.row),
      buttonText: "Choose",
    },
    matchActionButtons(state),
  );
}

function matchActionButtons(state: ScheduleState): ButtonSpec[] {
  return [];
}

function buildScheduleRow(match: MatchResult): {
  row: { id: string; title: string; description?: string };
  state: ScheduleRow;
} {
  const masked = maskPhone(match.whatsapp_e164 ?? "");
  const distanceLabel = typeof match.distance_km === "number"
    ? toDistanceLabel(match.distance_km)
    : null;
  const seenLabel = timeAgo(
    getMatchTimestamp(match) ?? new Date().toISOString(),
  );
  const details = [
    `Ref ${match.ref_code ?? "---"}`,
    distanceLabel,
    `Seen ${seenLabel}`,
  ].filter(Boolean).join(" • ");
  const rowId = `MTCH::${match.trip_id}`;
  return {
    row: {
      id: rowId,
      title: masked,
      description: details,
    },
    state: {
      id: rowId,
      whatsapp: match.whatsapp_e164 ?? "",
      ref: match.ref_code ?? "---",
      tripId: match.trip_id,
    },
  };
}

function toDistanceLabel(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1) return `${value.toFixed(1)} km`;
  return `${Math.round(value * 1000)} m`;
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
