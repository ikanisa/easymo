import type { SupabaseClient } from "../../deps.ts";

type CountryRow = {
  code: string;
  name: string;
  phone_code: string;
  momo_supported: boolean;
};

type CachedCountries = {
  expiresAt: number;
  items: Array<CountryRow & { prefix: string }>;
};

let cache: CachedCountries | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadCountries(
  supabase: SupabaseClient,
): Promise<Array<CountryRow & { prefix: string }>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.items;
  }
  const { data, error } = await supabase
    .from("countries")
    .select("code,name,phone_code,momo_supported");
  if (error) throw error;
  const items = (data ?? [])
    .map((row) => ({
      ...row,
      prefix: (row.phone_code ?? "").replace(/\D/g, ""),
    }))
    .filter((row) => row.prefix.length > 0)
    .sort((a, b) => b.prefix.length - a.prefix.length);
  cache = { items, expiresAt: now + CACHE_TTL_MS };
  return items;
}

function matchCountry(
  phoneDigits: string,
  rows: Array<CountryRow & { prefix: string }>,
): CountryRow | null {
  for (const row of rows) {
    if (phoneDigits.startsWith(row.prefix)) {
      return row;
    }
  }
  return null;
}

export type CountrySupportResult = {
  countryCode: string | null;
  countryName: string | null;
  momoSupported: boolean;
};

export async function checkCountrySupport(
  supabase: SupabaseClient,
  phoneNumber: string,
): Promise<CountrySupportResult> {
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits) {
    return { countryCode: null, countryName: null, momoSupported: false };
  }
  try {
    const rows = await loadCountries(supabase);
    const country = matchCountry(digits, rows);
    if (!country) {
      return { countryCode: null, countryName: null, momoSupported: false };
    }
    return {
      countryCode: country.code ?? null,
      countryName: country.name ?? null,
      momoSupported: country.momo_supported === true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("country_support.lookup_failed", { message });
    return {
      countryCode: null,
      countryName: null,
      momoSupported: digits.startsWith("250"),
    };
  }
}

export function resetCountrySupportCache(): void {
  cache = null;
}
