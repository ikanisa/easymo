import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

export interface CountrySupportResult {
  supported: boolean;
  countryCode?: string;
  countryName?: string;
  momoProvider?: string;
  message?: string;
}

/**
 * Extract country code from phone number
 */
export function extractCountryCode(phoneNumber: string): string {
  if (!phoneNumber) return "UNKNOWN";

  const cleaned = phoneNumber.replace(/\D/g, "");

  const countryMappings: Record<string, string> = {
    "250": "RW", // Rwanda
    "257": "BI", // Burundi
    "243": "CD", // DR Congo
    "255": "TZ", // Tanzania
    "260": "ZM", // Zambia
    "356": "MT", // Malta
    "1": "CA",   // Canada
  };

  for (const [prefix, code] of Object.entries(countryMappings)) {
    if (cleaned.startsWith(prefix)) {
      return code;
    }
  }

  return "UNKNOWN";
}

/**
 * Check if country supports a specific feature
 */
export async function checkCountrySupport(
  supabase: SupabaseClient,
  phoneNumber: string,
  feature: "momo" | "rides" | "insurance"
): Promise<CountrySupportResult> {
  const countryCode = extractCountryCode(phoneNumber);

  if (countryCode === "UNKNOWN") {
    return {
      supported: false,
      message: "❌ Could not determine your country from phone number.",
    };
  }

  const { data: country, error } = await supabase
    .from("countries")
    .select("*")
    .eq("country_code", countryCode)
    .single();

  if (error || !country) {
    return {
      supported: false,
      countryCode,
      message: `❌ ${feature.toUpperCase()} is not available in your country yet.`,
    };
  }

  let isSupported = false;
  let provider: string | undefined;

  switch (feature) {
    case "momo":
      isSupported = country.supports_momo === true;
      provider = country.momo_provider;
      break;
    case "rides":
      isSupported = country.supports_rides === true;
      break;
    case "insurance":
      isSupported = country.supports_insurance === true;
      break;
  }

  if (!isSupported) {
    return {
      supported: false,
      countryCode,
      countryName: country.country_name,
      message: `❌ ${feature.toUpperCase()} is not available in ${country.country_name} yet.\n\nWe're working on expanding to more countries. Stay tuned!`,
    };
  }

  return {
    supported: true,
    countryCode,
    countryName: country.country_name,
    momoProvider: provider,
  };
}

/**
 * Get MOMO provider info for country
 */
export async function getMomoProvider(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<{ provider: string; ussdFormat: string } | null> {
  const countryCode = extractCountryCode(phoneNumber);

  const { data: country } = await supabase
    .from("countries")
    .select("momo_provider, supports_momo")
    .eq("country_code", countryCode)
    .single();

  if (!country?.supports_momo) return null;

  // USSD formats by provider
  const ussdFormats: Record<string, string> = {
    "MTN": "*182*8*1*{CODE}#",      // Rwanda MTN MoMo merchant
    "Lumitel": "*889#",              // Burundi
    "Vodacom": "*171#",              // DR Congo
    "M-Pesa": "*150#",               // Tanzania
    "Airtel": "*778#",               // Zambia
  };

  return {
    provider: country.momo_provider || "Unknown",
    ussdFormat: ussdFormats[country.momo_provider] || "*#",
  };
}

/**
 * List all supported countries for a feature
 */
export async function listSupportedCountries(
  supabase: SupabaseClient,
  feature: "momo" | "rides" | "insurance"
): Promise<string[]> {
  let column: string;
  
  switch (feature) {
    case "momo":
      column = "supports_momo";
      break;
    case "rides":
      column = "supports_rides";
      break;
    case "insurance":
      column = "supports_insurance";
      break;
  }

  const { data: countries } = await supabase
    .from("countries")
    .select("country_name")
    .eq(column, true)
    .order("country_name");

  return (countries || []).map((c) => c.country_name);
}
