import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { toE164 } from "../_shared/phone.ts";
import { buildErrorResponse, buildInfoResponse } from "./utils.ts";
import type { SupabaseClient } from "./types.ts";

const identitySchema = z.object({
  wa_id: z.string().min(5),
  bar_name: z.string().min(2).max(80),
  location_text: z.string().min(5).max(120),
  country: z.string().min(2).max(40),
  city_area: z.string().min(2).max(60),
});

const contactsSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
  order_numbers_csv: z.string().min(5).max(160),
  momo_code: z.string().min(2).max(40),
});

const publishSchema = z.object({
  bar_id: z.string().uuid(),
});

const simpleBarSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
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

export async function handleOnboardIdentity(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = identitySchema.parse({
    wa_id: resolveField(payload, "wa_id") ?? payload.wa_id,
    bar_name: resolveField(payload, "bar_name"),
    location_text: resolveField(payload, "location_text"),
    country: resolveField(payload, "country"),
    city_area: resolveField(payload, "city_area"),
  });

  const slugBase = parsed.bar_name.trim().toLowerCase().replace(
    /[^a-z0-9]+/g,
    "-",
  ).replace(/^-|-$|/g, "");
  const slug = await ensureUniqueSlug(supabase, slugBase);

  const { data: bar, error } = await supabase
    .from("bars")
    .insert({
      slug,
      name: parsed.bar_name,
      location_text: parsed.location_text,
      country: parsed.country,
      city_area: parsed.city_area,
      is_active: false,
    })
    .select("id, name, city_area, country")
    .single();
  if (error) throw error;

  await supabase.from("bar_settings").insert({ bar_id: bar.id }).onConflict(
    "bar_id",
  ).ignore();
  await upsertBarNumber(supabase, bar.id, parsed.wa_id, "manager");

  return buildInfoResponse("s_contact_payment", {
    bar_id: bar.id,
    bar_name: bar.name,
    location: [bar.city_area, bar.country].filter(Boolean).join(" · "),
  });
}

export async function handleOnboardContacts(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = contactsSchema.parse({
    wa_id: resolveField(payload, "wa_id") ?? payload.wa_id,
    bar_id: resolveField(payload, "bar_id"),
    order_numbers_csv: resolveField(payload, "order_numbers_csv"),
    momo_code: resolveField(payload, "momo_code"),
  });

  const numbers = parsed.order_numbers_csv
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const normalizedNumbers = new Set<string>();
  for (const number of numbers) {
    const normalized = toE164(number);
    const digits = normalized.replace(/[^0-9]/g, "");
    if (!digits) continue;
    normalizedNumbers.add(normalized);
  }

  if (!normalizedNumbers.size) {
    return buildErrorResponse(
      "s_contact_payment",
      "Please provide at least one WhatsApp number.",
    );
  }

  for (const number of normalizedNumbers) {
    await upsertBarNumber(supabase, parsed.bar_id, number, "staff");
  }

  await supabase
    .from("bars")
    .update({ momo_code: parsed.momo_code })
    .eq("id", parsed.bar_id);

  return buildInfoResponse("s_upload_menu_info", {
    bar_id: parsed.bar_id,
    receiving_numbers: Array.from(normalizedNumbers),
  });
}

export async function handleOnboardUploaded(payload: Record<string, unknown>) {
  return buildInfoResponse("s_onboard_publish", {
    upload_acknowledged: true,
  });
}

export async function handleOnboardPublish(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = publishSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
  });

  const { data: counts } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("bar_id", parsed.bar_id)
    .eq("is_available", true);

  if ((counts?.length ?? 0) === 0) {
    return buildErrorResponse(
      "s_onboard_publish",
      "Add at least one menu item before publishing.",
    );
  }

  await supabase
    .from("bars")
    .update({ is_active: true })
    .eq("id", parsed.bar_id);

  await supabase
    .from("menus")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("bar_id", parsed.bar_id)
    .eq("status", "draft");

  return buildInfoResponse("s_onboard_done", {
    bar_id: parsed.bar_id,
    published: true,
  });
}

export async function handleOnboardReview(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = simpleBarSchema.parse({
    wa_id: resolveField(payload, "wa_id") ?? payload.wa_id,
    bar_id: resolveField(payload, "bar_id"),
  });

  const { data: bar, error } = await supabase
    .from("bars")
    .select("id, name, city_area, country")
    .eq("id", parsed.bar_id)
    .maybeSingle();
  if (error) throw error;
  if (!bar) {
    return buildErrorResponse("s_onboard_publish", "Bar not found.");
  }

  return buildInfoResponse("s_cat_tree", {
    bar_id: bar.id,
    bar_name: bar.name,
  });
}

async function ensureUniqueSlug(supabase: SupabaseClient, base: string) {
  let slug = base || `bar-${crypto.randomUUID().slice(0, 6)}`;
  let suffix = 1;
  // No select; rely on unique constraint and retry if conflict
  while (true) {
    const { data } = await supabase.from("bars").select("id").eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function upsertBarNumber(
  supabase: SupabaseClient,
  barId: string,
  number: string,
  role: "manager" | "staff",
) {
  const normalized = toE164(number);
  const digits = normalized.replace(/[^0-9]/g, "");
  if (!digits) return;
  await supabase
    .from("bar_numbers")
    .upsert(
      {
        bar_id: barId,
        number_e164: normalized,
        role,
        is_active: true,
      },
      { onConflict: "bar_id,number_e164" },
    );
}
