import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildErrorResponse, buildInfoResponse } from "./utils.ts";
import type { SupabaseClient } from "./types.ts";

const staffActionSchema = z.object({
  bar_id: z.string().uuid(),
  phone: z.string().min(6).max(20).optional(),
  role: z.enum(["manager", "staff"]).optional(),
});

const settingsSchema = z.object({
  bar_id: z.string().uuid(),
  momo_code: z.string().min(2).max(40),
  service_charge_pct: z.coerce.number().min(0).max(25),
  allow_direct_chat: z.enum(["true", "false"]),
  default_prep_minutes: z.coerce.number().int().min(0).max(240),
  payment_instructions: z.string().max(240).optional(),
});

function resolveField(payload: Record<string, unknown>, key: string) {
  if (key in payload && payload[key] !== undefined) return payload[key];
  const fields = (payload.fields as Record<string, unknown> | null) ??
    undefined;
  const context = (payload.context as Record<string, unknown> | null) ??
    undefined;
  if (fields && key in fields) return fields[key];
  if (context && key in context) return context[key];
  return undefined;
}

export async function handleStaffList(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const bar_id = resolveField(payload, "bar_id");
  if (typeof bar_id !== "string") {
    return buildErrorResponse("s_staff_list", "Bar not found.");
  }

  const { data, error } = await supabase
    .from("bar_numbers")
    .select("number_e164, role, is_active, verified_at")
    .eq("bar_id", bar_id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const staff_text = (data ?? [])
    .map((entry) =>
      `${entry.role}: ${entry.number_e164}${
        entry.is_active ? "" : " (inactive)"
      }`
    )
    .join("\n");

  return buildInfoResponse("s_staff_list", {
    bar_id,
    staff_text: staff_text || "No staff numbers yet.",
  });
}

export async function handleStaffAdd(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = staffActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    phone: resolveField(payload, "phone"),
    role: resolveField(payload, "role") ?? "staff",
  });

  if (!parsed.phone) {
    return buildErrorResponse("s_add_staff", "Phone required.");
  }

  await supabase
    .from("bar_numbers")
    .upsert(
      {
        bar_id: parsed.bar_id,
        number_e164: parsed.phone.replace(/\s+/g, ""),
        role: parsed.role,
        is_active: true,
      },
      { onConflict: "bar_id,number_e164" },
    );

  return handleStaffList(payload, supabase);
}

export async function handleStaffRemove(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = staffActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    phone: resolveField(payload, "phone"),
  });
  if (!parsed.phone) {
    return buildErrorResponse("s_remove_staff", "Select a number to remove.");
  }

  await supabase
    .from("bar_numbers")
    .delete()
    .eq("bar_id", parsed.bar_id)
    .eq("number_e164", parsed.phone.replace(/\s+/g, ""));

  return handleStaffList(payload, supabase);
}

export async function handleSaveSettings(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = settingsSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    momo_code: resolveField(payload, "momo_code"),
    service_charge_pct: resolveField(payload, "service_charge_pct"),
    allow_direct_chat: resolveField(payload, "allow_direct_chat"),
    default_prep_minutes: resolveField(payload, "default_prep_minutes"),
    payment_instructions: resolveField(payload, "payment_instructions"),
  });

  await supabase
    .from("bars")
    .update({ momo_code: parsed.momo_code })
    .eq("id", parsed.bar_id);

  await supabase
    .from("bar_settings")
    .upsert({
      bar_id: parsed.bar_id,
      service_charge_pct: parsed.service_charge_pct,
      allow_direct_customer_chat: parsed.allow_direct_chat === "true",
      default_prep_minutes: parsed.default_prep_minutes,
      payment_instructions: parsed.payment_instructions ?? null,
    });

  return buildInfoResponse("s_settings_saved", {
    bar_id: parsed.bar_id,
    saved: true,
  });
}
