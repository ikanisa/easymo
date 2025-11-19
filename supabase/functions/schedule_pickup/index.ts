import { serve } from "$std/http/server.ts";
import { z } from "zod";
import {
  generateCorrelationId,
  getCorrelationId,
  logRequest,
  logResponse,
  logStructuredEvent,
  logError,
} from "../_shared/observability.ts";
import { getServiceClient } from "shared/supabase.ts";
import { getSupabaseServiceConfig } from "shared/env.ts";

const supabase = getServiceClient();
const serviceConfig = getSupabaseServiceConfig();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

const depositSchema = z.object({
  enabled: z.boolean().optional(),
  momoNumber: z.string().min(5).optional(),
  provider: z.enum(["mtn", "airtel"]).default("mtn"),
  percent: z.number().min(0.1).max(0.5).optional(),
}).optional();

const pickupPayloadSchema = z.object({
  whatsapp: z.string().min(8),
  profileId: z.string().uuid().optional(),
  farmId: z.string().uuid().optional(),
  farmerName: z.string().min(2).optional(),
  locale: z.string().min(2).max(5).optional(),
  commodity: z.object({
    name: z.string().min(2),
    quantityKg: z.number().positive().optional(),
    quantityTons: z.number().positive().optional(),
    unitPriceRwF: z.number().positive().optional(),
    qualityNotes: z.string().optional(),
  }),
  pickupWindow: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    timezone: z.string().optional(),
    capacityTons: z.number().positive().optional(),
  }),
  location: z.object({
    district: z.string().min(2),
    sector: z.string().optional(),
    cell: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    description: z.string().optional(),
  }),
  buyerFocus: z.enum(["kigali_wholesale", "kigali_retail", "export", "local_market"]).default("kigali_wholesale"),
  notes: z.string().optional(),
  deposit: depositSchema,
});

type PickupPayload = z.infer<typeof pickupPayloadSchema>;

type FarmPickupWindow = {
  id: string;
  commodity: string;
  district: string;
  reserved_tonnes: number;
  capacity_tonnes: number;
};

type FarmPickupRegistration = {
  id: string;
  window_id: string;
  farm_id: string;
  profile_id: string | null;
  deposit_amount: number | null;
  deposit_percent: number | null;
  deposit_status: string;
};

function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) {
    throw new Error("invalid_whatsapp_number");
  }
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new Error("invalid_whatsapp_number");
  }
  return normalized;
}

function clampDepositPercent(percent?: number) {
  const baseline = Number.isFinite(percent) ? Number(percent) : 0.25;
  return Math.min(0.3, Math.max(0.2, baseline));
}

function toTons(commodity: PickupPayload["commodity"]): number {
  if (commodity.quantityTons && commodity.quantityTons > 0) {
    return commodity.quantityTons;
  }
  if (commodity.quantityKg && commodity.quantityKg > 0) {
    return commodity.quantityKg / 1000;
  }
  throw new Error("missing_quantity");
}

function computeDepositAmount(payload: PickupPayload, tons: number, percent: number) {
  const unitPrice = payload.commodity.unitPriceRwF ?? 480;
  const estimated = tons * 1000 * unitPrice;
  return Math.round(estimated * percent);
}

async function ensureProfile(payload: PickupPayload, normalized: string) {
  if (payload.profileId) {
    return payload.profileId;
  }
  const existing = await supabase
    .from("profiles")
    .select("user_id, metadata")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error;
  }
  type FarmerMetadata = Record<string, unknown> & {
    farmer_profile?: Record<string, unknown>;
    preferred_language?: string;
  };
  const currentMetadata = (existing.data?.metadata as FarmerMetadata | null) ?? {};
  const nextMetadata = {
    ...currentMetadata,
    farmer_profile: {
      ...(currentMetadata.farmer_profile as Record<string, unknown> | undefined),
      label: payload.farmerName ?? (currentMetadata.farmer_profile as any)?.label ?? payload.commodity.name,
      district: payload.location.district,
      sector: payload.location.sector,
      commodities: payload.commodity.name,
      updated_at: new Date().toISOString(),
    },
  };
  const upsert = await supabase
    .from("profiles")
    .upsert({
      whatsapp_e164: normalized,
      locale: payload.locale ?? currentMetadata.preferred_language ?? "rw",
      metadata: nextMetadata,
    }, { onConflict: "whatsapp_e164" })
    .select("user_id")
    .single();
  if (upsert.error) {
    throw upsert.error;
  }
  return upsert.data.user_id as string;
}

async function ensureFarm(profileId: string, payload: PickupPayload) {
  if (payload.farmId) {
    return payload.farmId;
  }
  const existing = await supabase
    .from("farms")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing.data?.id) {
    return existing.data.id as string;
  }
  const insert = await supabase
    .from("farms")
    .insert({
      profile_id: profileId,
      farm_name: payload.farmerName ?? `${payload.location.district} Farm`,
      district: payload.location.district,
      sector: payload.location.sector ?? null,
      region: payload.location.district.match(/kigali/i) ? "Kigali" : "Rwanda",
      commodities: [payload.commodity.name],
      metadata: {
        buyer_focus: payload.buyerFocus,
        location: payload.location,
      },
    })
    .select("id")
    .single();
  if (insert.error) {
    throw insert.error;
  }
  return insert.data.id as string;
}

async function findOrCreateWindow(payload: PickupPayload, quantityTons: number, correlationId: string): Promise<FarmPickupWindow> {
  const start = new Date(payload.pickupWindow.start);
  const end = new Date(payload.pickupWindow.end);
  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    throw new Error("invalid_window");
  }
  if (end <= start) {
    throw new Error("invalid_window_range");
  }
  const capacityTarget = payload.pickupWindow.capacityTons ?? Math.max(quantityTons * 1.5, 5);
  const candidates = await supabase
    .from("farm_pickup_windows")
    .select("id, commodity, district, reserved_tonnes, capacity_tonnes, window_start")
    .eq("commodity", payload.commodity.name.toLowerCase())
    .eq("district", payload.location.district)
    .eq("status", "draft")
    .gte("window_end", new Date().toISOString())
    .order("window_start", { ascending: true })
    .limit(3);
  if (candidates.error) {
    throw candidates.error;
  }
  let windowRecord = candidates.data?.find((row) => {
    const slotStart = new Date(row.window_start);
    return Math.abs(slotStart.getTime() - start.getTime()) <= 6 * 60 * 60 * 1000 && (row.reserved_tonnes ?? 0) + quantityTons <= row.capacity_tonnes;
  });
  if (!windowRecord) {
    const insert = await supabase
      .from("farm_pickup_windows")
      .insert({
        commodity: payload.commodity.name.toLowerCase(),
        district: payload.location.district,
        sector: payload.location.sector ?? null,
        window_start: start.toISOString(),
        window_end: end.toISOString(),
        capacity_tonnes: capacityTarget,
        reserved_tonnes: 0,
        buyer_focus: payload.buyerFocus,
        metadata: {
          timezone: payload.pickupWindow.timezone ?? "Africa/Kigali",
          requested_capacity: quantityTons,
          correlationId,
        },
      })
      .select("id, commodity, district, reserved_tonnes, capacity_tonnes")
      .single();
    if (insert.error) {
      throw insert.error;
    }
    windowRecord = insert.data as FarmPickupWindow;
  }
  const reservation = await supabase.rpc("reserve_farm_pickup_capacity", {
    p_window_id: windowRecord.id,
    p_quantity: quantityTons,
  });
  if (reservation.error) {
    logError("pickup_capacity", reservation.error, { windowId: windowRecord.id, quantityTons, correlationId });
    throw reservation.error;
  }
  return reservation.data as FarmPickupWindow;
}

async function createRegistration(
  payload: PickupPayload,
  profileId: string,
  farmId: string,
  window: FarmPickupWindow,
  quantityTons: number,
  percent: number,
  depositAmount: number | null,
) {
  const insert = await supabase
    .from("farm_pickup_registrations")
    .insert({
      window_id: window.id,
      farm_id: farmId,
      profile_id: profileId,
      commodity: payload.commodity.name.toLowerCase(),
      quantity_tonnes: quantityTons,
      price_per_tonne: payload.commodity.unitPriceRwF ?? null,
      buyer_focus: payload.buyerFocus,
      deposit_percent: depositAmount ? percent : null,
      deposit_amount: depositAmount,
      metadata: {
        notes: payload.notes,
        location: payload.location,
        quality_notes: payload.commodity.qualityNotes,
      },
    })
    .select("id, window_id, farm_id, profile_id, deposit_amount, deposit_percent, deposit_status")
    .single();
  if (insert.error) {
    throw insert.error;
  }
  return insert.data as FarmPickupRegistration;
}

async function initiateDeposit(
  registrationId: string,
  amount: number,
  phoneNumber: string,
  provider: string,
  correlationId: string,
) {
  const response = await fetch(`${serviceConfig.url}/functions/v1/momo-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceConfig.serviceRoleKey}`,
      "X-Correlation-ID": correlationId,
    },
    body: JSON.stringify({
      registrationId,
      amount,
      currency: "RWF",
      phoneNumber,
      provider,
      mode: "farmer_deposit",
    }),
  });
  const body = await response.json().catch(() => ({ error: "invalid_response" }));
  if (!response.ok) {
    return { success: false, error: body?.error ?? "deposit_failed" };
  }
  return body;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const correlationId = getCorrelationId(req) || generateCorrelationId();
  logRequest("schedule_pickup", req, { correlationId });
  try {
    const raw = await req.json();
    const payload = pickupPayloadSchema.parse(raw) as PickupPayload;
    const normalized = normalizeWhatsAppNumber(payload.whatsapp);
    const percent = clampDepositPercent(payload.deposit?.percent);
    const quantityTons = toTons(payload.commodity);
    const profileId = await ensureProfile(payload, normalized);
    const farmId = await ensureFarm(profileId, payload);
    const window = await findOrCreateWindow(payload, quantityTons, correlationId);
    const depositAmount = payload.deposit?.enabled && payload.deposit?.momoNumber
      ? computeDepositAmount(payload, quantityTons, percent)
      : null;
    const registration = await createRegistration(payload, profileId, farmId, window, quantityTons, percent, depositAmount);

    let depositResult: Record<string, unknown> | null = null;
    if (depositAmount && payload.deposit?.momoNumber) {
      depositResult = await initiateDeposit(registration.id, depositAmount, payload.deposit.momoNumber, payload.deposit.provider ?? "mtn", correlationId);
      if (!depositResult?.success) {
        await supabase
          .from("farm_pickup_registrations")
          .update({ deposit_status: "failed" })
          .eq("id", registration.id);
      }
    }

    await logStructuredEvent("FARM_PICKUP_SCHEDULED", {
      correlationId,
      farmId,
      profileId,
      windowId: window.id,
      commodity: payload.commodity.name,
      quantityTons,
      buyerFocus: payload.buyerFocus,
      depositAmount,
    });

    const responseBody = {
      success: true,
      windowId: window.id,
      registrationId: registration.id,
      pickupStart: payload.pickupWindow.start,
      pickupEnd: payload.pickupWindow.end,
      deposit: depositResult,
    };

    logResponse("schedule_pickup", 200, { correlationId });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  } catch (error) {
    logError("schedule_pickup", error, { correlationId });
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError ? error.errors : (error as Error).message;
    return new Response(JSON.stringify({ error: message, correlationId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  }
});
