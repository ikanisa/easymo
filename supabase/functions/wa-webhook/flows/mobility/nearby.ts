import type { RouterContext } from "../../types.ts";
import { sendList, sendText } from "../../wa/client.ts";
import { setState, clearState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { recentDriversNear, recentPassengersNear } from "../../rpc/mobility.ts";
import { timeAgo } from "../../utils/text.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../support.ts";

export const VEHICLE_OPTIONS: Array<{ id: string; title: string }> = [
  { id: "veh_moto", title: "Moto taxi" },
  { id: "veh_cab", title: "Cab" },
  { id: "veh_lifan", title: "Lifan" },
  { id: "veh_truck", title: "Truck" },
  { id: "veh_others", title: "Others" },
];

type NearbyMode = "drivers" | "passengers";

export type NearbyState = {
  mode: NearbyMode;
  vehicle?: string;
  rows?: Array<{ id: string; whatsapp: string; ref: string }>;
};

export function vehicleFromId(id: string): string {
  return id.replace("veh_", "");
}

export async function handleSeeDrivers(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: "mobility_nearby_select", data: { mode: "drivers" } });
  await sendList(ctx.from, {
    title: "Nearby drivers",
    body: "Choose vehicle type",
    sectionTitle: "Vehicle",
    rows: VEHICLE_OPTIONS,
  });
  return true;
}

export async function handleSeePassengers(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: "mobility_nearby_select", data: { mode: "passengers" } });
  await sendList(ctx.from, {
    title: "Nearby passengers",
    body: "Choose vehicle type",
    sectionTitle: "Vehicle",
    rows: VEHICLE_OPTIONS,
  });
  return true;
}

export async function handleVehicleSelection(ctx: RouterContext, state: NearbyState, id: string): Promise<boolean> {
  if (!ctx.profileId) return false;
  const vehicleType = vehicleFromId(id);
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_location",
    data: { mode: state.mode, vehicle: vehicleType },
  });
  await sendText(ctx.from, "Share your location (tap ➕ → Location).");
  return true;
}

export async function handleNearbyLocation(
  ctx: RouterContext,
  state: NearbyState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.vehicle || !state.mode) return false;
  const config = await getAppConfig(ctx.supabase);
  const radius = config.search_radius_km ?? 10;
  const max = config.max_results ?? 9;
  if (state.mode === "drivers") {
    const drivers = await recentDriversNear(ctx.supabase, {
      lat: coords.lat,
      lng: coords.lng,
      vehicleType: state.vehicle,
      radiusKm: radius,
      max,
    });
    if (!drivers.length) {
      await sendText(ctx.from, "No drivers nearby right now. Try again soon.");
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
    const rows = drivers.map((driver) => ({
      id: `chat_${driver.whatsapp_e164}`,
      title: `Ref ${driver.ref_code} • ${timeAgo(driver.last_seen)}`,
      description: maskPhone(driver.whatsapp_e164),
    }));
    await setState(ctx.supabase, ctx.profileId, {
      key: "mobility_nearby_results",
      data: {
        mode: state.mode,
        vehicle: state.vehicle,
        rows: drivers.map((d) => ({ id: `chat_${d.whatsapp_e164}`, whatsapp: d.whatsapp_e164, ref: d.ref_code })),
      },
    });
    await sendList(ctx.from, {
      title: "Drivers nearby",
      body: "Tap a driver to open chat",
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
    await sendText(ctx.from, "No passengers nearby right now. Try again soon.");
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }
  const rows = passengers.map((p) => ({
    id: `chat_${p.whatsapp_e164}`,
    title: `Ref ${p.ref_code} • ${timeAgo(p.created_at)}`,
    description: maskPhone(p.whatsapp_e164),
  }));
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_nearby_results",
    data: {
      mode: state.mode,
      vehicle: state.vehicle,
      rows: passengers.map((p) => ({ id: `chat_${p.whatsapp_e164}`, whatsapp: p.whatsapp_e164, ref: p.ref_code })),
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

export async function handleNearbyResultSelection(ctx: RouterContext, state: NearbyState, id: string): Promise<boolean> {
  if (!state.rows || !ctx.profileId) return false;
  const match = state.rows.find((row) => row.id === id);
  if (!match) return false;
  const link = waChatLink(match.whatsapp, `Hi, I'm Ref ${match.ref}`);
  await sendText(ctx.from, `Open chat: ${link}`);
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

export function isVehicleOption(id: string): boolean {
  return VEHICLE_OPTIONS.some((opt) => opt.id === id);
}
