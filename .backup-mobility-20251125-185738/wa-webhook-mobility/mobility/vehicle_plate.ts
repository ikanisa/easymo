import type { RouterContext } from "../../types.ts";
import type { SupabaseClient } from "../../deps.ts";
import { setState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";

const PLATE_STATE_KEY = "vehicle_plate_register";

type ResumeState =
  | { type: "schedule_role"; roleId: string }
  | { type: "nearby_passengers" };

type PlateStateData = ResumeState;

export function normalizePlate(input: string): string | null {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleaned.length < 4 || cleaned.length > 10) return null;
  return cleaned;
}

export function isPlateFormatValid(input: string): boolean {
  const normalized = normalizePlate(input);
  if (!normalized) return false;
  // Accept alphanumeric plates (4-10 chars)
  return /^[A-Z0-9]{4,10}$/.test(normalized);
}

export async function getVehiclePlate(
  client: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("vehicle_plate")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  const value = data?.vehicle_plate;
  if (typeof value !== "string") return null;
  return value.trim().toUpperCase() || null;
}

export async function updateVehiclePlate(
  client: SupabaseClient,
  profileId: string,
  plate: string,
): Promise<void> {
  const normalized = normalizePlate(plate);
  if (!normalized) {
    throw new Error("Invalid vehicle plate");
  }
  const { error } = await client
    .from("profiles")
    .update({ vehicle_plate: normalized })
    .eq("user_id", profileId);
  if (error) throw error;
}

export async function ensureVehiclePlate(
  ctx: RouterContext,
  resume: ResumeState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const existing = await getVehiclePlate(ctx.supabase, ctx.profileId);
  if (existing) return true;
  const prompt =
    "🚘 RURA regulation: please reply with your vehicle plate (e.g. RAA123C) to continue.";
  await setState(ctx.supabase, ctx.profileId, {
    key: PLATE_STATE_KEY,
    data: resume,
  });
  await sendText(ctx.from, prompt);
  return false;
}

export const vehiclePlateStateKey = PLATE_STATE_KEY;

export function parsePlateState(
  data: Record<string, unknown> | undefined,
): PlateStateData | null {
  if (!data) return null;
  const type = typeof data.type === "string" ? data.type : null;
  if (type === "schedule_role") {
    const roleId = typeof data.roleId === "string" ? data.roleId : null;
    if (!roleId) return null;
    return { type, roleId };
  }
  if (type === "nearby_passengers") {
    return { type };
  }
  return null;
}

export async function handleVehiclePlateInput(
  ctx: RouterContext,
  _resume: PlateStateData,
  value: string,
): Promise<string | null> {
  if (!ctx.profileId) return "Missing profile";
  const normalized = normalizePlate(value);
  if (!normalized || !isPlateFormatValid(normalized)) {
    return "Plate must be 4-10 letters/numbers. Example: RAA123C.";
  }
  await updateVehiclePlate(ctx.supabase, ctx.profileId, normalized);
  return null;
}

export async function getStoredVehicleType(
  client: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("vehicle_type")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  const value = data?.vehicle_type;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateStoredVehicleType(
  client: SupabaseClient,
  profileId: string,
  vehicleType: string,
): Promise<void> {
  const normalized = vehicleType.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Invalid vehicle type");
  }
  const { error } = await client
    .from("profiles")
    .update({ vehicle_type: normalized })
    .eq("user_id", profileId);
  if (error) throw error;
}
