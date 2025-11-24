import type { SupabaseClient } from "../deps.ts";
import {
  buildDigitFuzzyPattern,
  buildNumberLookupCandidates,
  digitsOnly,
  toE164,
} from "./phone.ts";

const PATTERN_RESULT_LIMIT = 10;

type BarNumberRow = {
  id: string;
  bar_id: string;
  number_e164: string | null;
  [key: string]: unknown;
};

function parseColumns(columns: string): string[] {
  return columns.split(",").map((value) => value.trim()).filter(Boolean);
}

function mergeSelectColumns(columns: string): string {
  const base = new Set<string>(["id", "number_e164"]);
  for (const column of parseColumns(columns)) {
    base.add(column);
  }
  return Array.from(base).join(",");
}

function digitsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.endsWith(b) || b.endsWith(a);
}

async function canonicalizeRow(
  client: SupabaseClient,
  row: BarNumberRow,
  canonical: string,
  targetDigits: string,
): Promise<void> {
  const current = row.number_e164 ?? "";
  if (!current || current === canonical) return;
  const currentDigits = digitsOnly(current);
  if (!digitsEquivalent(currentDigits, targetDigits)) return;
  const { error } = await client
    .from("bar_numbers")
    .update({ number_e164: canonical })
    .eq("id", row.id);
  if (error) {
    console.warn("bar_numbers.canonicalize_fail", error, {
      id: row.id,
      candidate: canonical,
    });
    return;
  }
  row.number_e164 = canonical;
}

export async function loadActiveBarNumbers<T extends BarNumberRow>(
  client: SupabaseClient,
  waNumber: string,
  columns: string,
): Promise<T[]> {
  const canonical = toE164(waNumber);
  const digits = digitsOnly(waNumber);
  const selectColumns = mergeSelectColumns(columns);
  const results: T[] = [];
  const seen = new Set<string>();

  async function pushRows(rows?: BarNumberRow[] | null) {
    if (!rows) return;
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      if (digits && row.number_e164) {
        const rowDigits = digitsOnly(row.number_e164);
        if (!digitsEquivalent(rowDigits, digits)) continue;
        await canonicalizeRow(client, row, canonical, digits);
      }
      seen.add(row.id);
      results.push(row as T);
    }
  }

  if (digits) {
    const { data, error } = await client
      .from("bar_numbers")
      .select(selectColumns)
      .eq("is_active", true)
      .eq("number_digits", digits)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PATTERN_RESULT_LIMIT);
    if (error) {
      if (error.code !== "42703") throw error;
    } else {
      await pushRows(coerceRows<BarNumberRow>(data));
      if (results.length) return results;
    }
  }

  const candidates = buildNumberLookupCandidates(waNumber);
  for (const candidate of candidates) {
    const { data, error } = await client
      .from("bar_numbers")
      .select(selectColumns)
      .eq("is_active", true)
      .eq("number_e164", candidate)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    await pushRows(coerceRows<BarNumberRow>(data));
    if (results.length) return results;
  }

  if (!digits) return results;
  const pattern = buildDigitFuzzyPattern(digits);
  const { data, error } = await client
    .from("bar_numbers")
    .select(selectColumns)
    .eq("is_active", true)
    .ilike("number_e164", pattern)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PATTERN_RESULT_LIMIT);
  if (error) throw error;
  await pushRows(coerceRows<BarNumberRow>(data));

  return results;
}

function coerceRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function findActiveBarNumber(
  client: SupabaseClient,
  waNumber: string,
): Promise<BarNumberRow | null> {
  const rows = await loadActiveBarNumbers(client, waNumber, "bar_id");
  if (rows.length) return rows[0];
  return await provisionBarForNumber(client, waNumber);
}

type BusinessCandidate = {
  id: string;
  name?: string | null;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string | null;
  created_at?: string | null;
};

async function provisionBarForNumber(
  client: SupabaseClient,
  waNumber: string,
): Promise<BarNumberRow | null> {
  const canonical = toE164(waNumber);
  if (!canonical) return null;
  const normalizedDigits = digitsOnly(canonical);
  if (!normalizedDigits) return null;

  // Reactivate existing mapping if present but inactive.
  const { data: existingRows, error: existingError } = await client
    .from("bar_numbers")
    .select("id, bar_id, is_active")
    .eq("number_e164", canonical);
  if (!existingError && (existingRows?.length ?? 0) > 0) {
    const activeRow = existingRows.find((row) => row.is_active);
    if (activeRow) {
      const { data, error } = await client
        .from("bar_numbers")
        .select("id, bar_id, number_e164")
        .eq("id", activeRow.id)
        .maybeSingle();
      if (!error && data) return data as BarNumberRow;
    }
    const target = existingRows[0];
    const { error: reactivateError } = await client
      .from("bar_numbers")
      .update({ is_active: true, verified_at: new Date().toISOString() })
      .eq("id", target.id);
    if (reactivateError) {
      console.error("bar_numbers.reactivate_fail", reactivateError, {
        number: canonical,
      });
    } else {
      const { data, error } = await client
        .from("bar_numbers")
        .select("id, bar_id, number_e164")
        .eq("id", target.id)
        .maybeSingle();
      if (!error && data) return data as BarNumberRow;
    }
  }

  const candidate = await selectBusinessCandidate(client, canonical);
  const barName = deriveBarName(candidate, canonical);
  const slugBase = slugify(barName) || `bar-${normalizedDigits.slice(-6)}`;
  const slug = await ensureUniqueBarSlug(client, slugBase);

  const barPayload: Record<string, unknown> = {
    name: barName,
    slug,
    location_text: candidate?.location_text ?? null,
    is_active: false,
  };
  const inferred = inferCountryAndCurrency(candidate, canonical);
  if (inferred.country) barPayload.country = inferred.country;
  if (inferred.currency) barPayload.currency = inferred.currency;
  if (candidate?.lat != null && candidate?.lng != null) {
    barPayload.city_area = null;
  }

  let barId: string | null = null;
  const { data: insertedBar, error: insertError } = await client
    .from("bars")
    .insert(barPayload)
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existingBar, error: existingBarError } = await client
        .from("bars")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existingBarError || !existingBar) {
        console.error("bars.lookup_fail", existingBarError ?? insertError, {
          slug,
        });
        return null;
      }
      barId = existingBar.id as string;
    } else {
      console.error("bars.insert_fail", insertError, { slug, barName });
      return null;
    }
  } else {
    barId = (insertedBar as { id: string }).id;
  }

  if (!barId) return null;

  const nowIso = new Date().toISOString();
  const upsertPayload = {
    bar_id: barId,
    number_e164: canonical,
    role: "manager",
    is_active: true,
    verified_at: nowIso,
    added_by: "auto_provision",
    last_seen_at: nowIso,
  };
  const { error: upsertError } = await client
    .from("bar_numbers")
    .upsert(upsertPayload, { onConflict: "bar_id,number_e164" });
  if (upsertError) {
    console.error("bar_numbers.auto_provision_fail", upsertError, {
      barId,
      number: canonical,
    });
    return null;
  }

  const { error: settingsError } = await client
    .from("bar_settings")
    .upsert({ bar_id: barId }, { onConflict: "bar_id" });
  if (settingsError) {
    console.warn("bar_settings.auto_create_fail", settingsError, { barId });
  }

  const { data: activeRow, error: activeError } = await client
    .from("bar_numbers")
    .select("id, bar_id, number_e164")
    .eq("bar_id", barId)
    .eq("number_e164", canonical)
    .eq("is_active", true)
    .maybeSingle();
  if (activeError) {
    console.error("bar_numbers.fetch_after_provision_fail", activeError, {
      barId,
    });
    return null;
  }

  if (activeRow) {
    console.log("bar_numbers.auto_provision_success", {
      barId,
      number: canonical,
      businessId: candidate?.id ?? null,
    });
    return activeRow as BarNumberRow;
  }

  return null;
}

async function selectBusinessCandidate(
  client: SupabaseClient,
  canonicalNumber: string,
): Promise<BusinessCandidate | null> {
  const { data, error } = await client
    .from("business")
    .select(
      "id, name, location_text, lat, lng, status, created_at",
    )
    .eq("owner_whatsapp", canonicalNumber)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("business.lookup_fail", error, { owner: canonicalNumber });
    return null;
  }
  const rows = data ?? [];
  if (!rows.length) return null;
  const approved = rows.find((row) => row.status === "approved");
  if (approved) return approved as BusinessCandidate;
  const withLocation = rows.find((row) => row.lat != null && row.lng != null);
  if (withLocation) return withLocation as BusinessCandidate;
  return rows[0] as BusinessCandidate;
}

function deriveBarName(
  candidate: BusinessCandidate | null,
  canonicalNumber: string,
): string {
  const name = candidate?.name?.trim();
  if (name && name.length >= 2) return name.slice(0, 80);
  return `Vendor ${canonicalNumber.slice(-4)}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function ensureUniqueBarSlug(
  client: SupabaseClient,
  base: string,
): Promise<string> {
  let attempt = 0;
  let candidate = base.length ? base : `bar-${crypto.randomUUID().slice(0, 6)}`;
  while (attempt < 10) {
    const { data, error } = await client
      .from("bars")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) {
      console.error("bars.slug_check_fail", error, { candidate });
      break;
    }
    if (!data) return candidate;
    attempt += 1;
    candidate = base.length
      ? `${base}-${attempt}`
      : `bar-${crypto.randomUUID().slice(0, 6)}`;
  }
  return `${base || "bar"}-${crypto.randomUUID().slice(0, 8)}`;
}

function inferCountryAndCurrency(
  candidate: BusinessCandidate | null,
  canonicalNumber: string,
): { country?: string; currency?: string } {
  if (!candidate) {
    return guessByDialCode(canonicalNumber);
  }
  if (candidate.lat != null && candidate.lng != null) {
    // Rough bounding box for Rwanda
    if (
      candidate.lat > -2.5 && candidate.lat < -1 &&
      candidate.lng > 29 && candidate.lng < 31
    ) {
      return { country: "Rwanda", currency: "RWF" };
    }
  }
  return guessByDialCode(canonicalNumber);
}

function guessByDialCode(
  number: string,
): { country?: string; currency?: string } {
  // Supported countries only
  if (number.startsWith("+250")) {
    return { country: "Rwanda", currency: "RWF" };
  }
  if (number.startsWith("+257")) {
    return { country: "Burundi", currency: "BIF" };
  }
  if (number.startsWith("+255")) {
    return { country: "Tanzania", currency: "TZS" };
  }
  if (number.startsWith("+243")) {
    return { country: "Congo DRC", currency: "CDF" };
  }
  // Default to Rwanda
  return { country: "Rwanda", currency: "RWF" };
}
