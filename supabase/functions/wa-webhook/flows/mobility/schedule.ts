import type { RouterContext } from "../../types.ts";
import { sendButtons, sendList, sendText } from "../../wa/client.ts";
import { setState, clearState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { VEHICLE_OPTIONS, vehicleFromId, NearbyState } from "./nearby.ts";
import { gateProFeature, insertTrip, recentDriversNear, recentPassengersNear } from "../../rpc/mobility.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../support.ts";

const ROLE_OPTIONS = [
  { id: IDS.ROLE_PASSENGER, title: "Passenger" },
  { id: IDS.ROLE_DRIVER, title: "Driver" },
];

type ScheduleState = NearbyState & {
  role?: "driver" | "passenger";
  tripId?: string;
};

export async function startScheduleTrip(ctx: RouterContext, _state: { key: string; data?: Record<string, unknown> }): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: "schedule_role", data: {} });
  await sendButtons(ctx.from, "Schedule Trip", [
    ROLE_OPTIONS[0],
    ROLE_OPTIONS[1],
    { id: IDS.BACK_HOME, title: "Back" },
  ]);
  return true;
}

export async function handleScheduleRole(ctx: RouterContext, id: string): Promise<boolean> {
  if (!ctx.profileId) return false;
  const role = id === IDS.ROLE_DRIVER ? "driver" : id === IDS.ROLE_PASSENGER ? "passenger" : null;
  if (!role) return false;
  await setState(ctx.supabase, ctx.profileId, { key: "schedule_vehicle", data: { role } });
  await sendList(ctx.from, {
    title: role === "driver" ? "You are a driver" : "You are a passenger",
    body: "Choose vehicle type",
    sectionTitle: "Vehicle",
    rows: VEHICLE_OPTIONS,
  });
  return true;
}

export async function handleScheduleVehicle(ctx: RouterContext, state: ScheduleState, vehicleId: string): Promise<boolean> {
  if (!ctx.profileId || !state.role) return false;
  const vehicleType = vehicleFromId(vehicleId);
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_location",
    data: { role: state.role, vehicle: vehicleType },
  });
  await sendText(ctx.from, "Share pickup location (tap ➕ → Location).");
  return true;
}

export async function handleScheduleLocation(
  ctx: RouterContext,
  state: ScheduleState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) return false;
  const config = await getAppConfig(ctx.supabase);
  const radius = config.search_radius_km ?? 10;
  const max = config.max_results ?? 9;

  if (state.role === "driver") {
    const gate = await gateProFeature(ctx.supabase, ctx.profileId);
    if (!gate.access) {
      await sendText(ctx.from, "Pro required to schedule as driver. Dial the MoMo menu in Wallet to upgrade.");
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
  }

  const tripId = await insertTrip(ctx.supabase, {
    userId: ctx.profileId,
    role: state.role,
    vehicleType: state.vehicle,
    lat: coords.lat,
    lng: coords.lng,
  });

  if (state.role === "passenger") {
    const drivers = await recentDriversNear(ctx.supabase, {
      lat: coords.lat,
      lng: coords.lng,
      vehicleType: state.vehicle,
      radiusKm: radius,
      max,
    });
    if (!drivers.length) {
      await sendText(ctx.from, "Trip saved. No drivers nearby yet.");
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
    const rows = drivers.map((driver) => ({
      id: `sched_chat_${driver.whatsapp_e164}`,
      title: `Ref ${driver.ref_code} • ${maskPhone(driver.whatsapp_e164)}`,
      description: timeAgo(driver.last_seen),
    }));
    await setState(ctx.supabase, ctx.profileId, {
      key: "schedule_results",
      data: {
        role: state.role,
        vehicle: state.vehicle,
        tripId,
        rows: drivers.map((d) => ({ id: `sched_chat_${d.whatsapp_e164}`, whatsapp: d.whatsapp_e164, ref: d.ref_code })),
      },
    });
    await sendList(ctx.from, {
      title: "Drivers nearby",
      body: "Tap a driver to chat",
      sectionTitle: "Drivers",
      rows,
    });
    return true;
  }
  const passengers = await recentPassengersNear(ctx.supabase, {
    lat: coords.lat,
    lng: coords.lng,
    vehicleType: state.vehicle,
    radiusKm: radius,
    max,
  });
  if (!passengers.length) {
    await sendText(ctx.from, "Trip saved. No passengers nearby yet.");
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }
  const rows = passengers.map((p) => ({
    id: `sched_chat_${p.whatsapp_e164}`,
    title: `Ref ${p.ref_code} • ${maskPhone(p.whatsapp_e164)}`,
    description: timeAgo(p.created_at),
  }));
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_results",
    data: {
      role: state.role,
      vehicle: state.vehicle,
      tripId,
      rows: passengers.map((p) => ({ id: `sched_chat_${p.whatsapp_e164}`, whatsapp: p.whatsapp_e164, ref: p.ref_code })),
    },
  });
  await sendList(ctx.from, {
    title: "Passengers nearby",
    body: "Tap a passenger to chat",
    sectionTitle: "Passengers",
    rows,
  });
  return true;
}

export async function handleScheduleResultSelection(ctx: RouterContext, state: ScheduleState, id: string): Promise<boolean> {
  if (!state.rows || !ctx.profileId) return false;
  const match = state.rows.find((row) => row.id === id);
  if (!match) return false;
  const link = waChatLink(match.whatsapp, `Hi, I'm Ref ${match.ref}`);
  await sendText(ctx.from, `Open chat: ${link}`);
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

export function isScheduleRole(id: string): boolean {
  return id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER;
}

export function isScheduleResult(id: string): boolean {
  return id.startsWith("sched_chat_");
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffSec = Math.floor((Date.now() - then) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch (_err) {
    return "";
  }
}
