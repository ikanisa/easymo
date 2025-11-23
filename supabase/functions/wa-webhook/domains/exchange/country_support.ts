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
  feature: "momo" | "rides" | "insurance",
): Promise<CountrySupportResult> {
  const countryCode = extractCountryCode(phoneNumber);

  if (countryCode === "UNKNOWN") {
    return {
      supported: false,
      message: "❌ Could not determine your country from phone number.",
    };
  }

  // Support both legacy and new schemas:
  // - Legacy: columns: id, name, code, phone_code, momo_supported
  // - New:    columns: country_code, country_name, supports_momo, supports_rides, supports_insurance, momo_provider
  const { data: list, error } = await supabase
    .from("countries")
    .select("*");

  if (error) {
    return {
      supported: false,
      message: "❌ Countries metadata not available.",
    };
  }

  const country = (list || []).find((c: any) => {
    const codeLegacy = (c && typeof c.code === "string") ? c.code.toUpperCase() : null;
    const codeNew = (c && typeof c.country_code === "string")
      ? c.country_code.toUpperCase()
      : null;
    return codeLegacy === countryCode || codeNew === countryCode;
  }) as any | undefined;

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
    case "momo": {
      const flagNew = country.supports_momo === true;
      const flagLegacy = country.momo_supported === true;
      isSupported = flagNew || flagLegacy;
      provider = country.momo_provider;
      break;
    }
    case "rides": {
      // Legacy schema had no rides flag; default to true if missing
      const flagNew = country.supports_rides === true;
      isSupported = flagNew ?? false;
      break;
    }
    case "insurance": {
      // Legacy schema had no insurance flag; default to true if missing
      const flagNew = country.supports_insurance === true;
      isSupported = flagNew ?? false;
      break;
    }
  }

  if (!isSupported) {
    return {
      supported: false,
      countryCode,
    countryName: country.country_name ?? country.name,
    message: `❌ ${feature.toUpperCase()} is not available in ${country.country_name ?? country.name} yet.\n\nWe're working on expanding to more countries. Stay tuned!`,
  };
  }

  return {
    supported: true,
    countryCode,
    countryName: country.country_name ?? country.name,
    momoProvider: provider,
  };
}

/**
 * Get MOMO provider info for country
 */
export async function getMomoProvider(
  supabase: SupabaseClient,
  phoneNumber: string,
): Promise<{ provider: string; ussdFormat: string } | null> {
  const countryCode = extractCountryCode(phoneNumber);
  const { data: list } = await supabase
    .from("countries")
    .select("*");

  const country = (list || []).find((c: any) => {
    const codeLegacy = (c && typeof c.code === "string") ? c.code.toUpperCase() : null;
    const codeNew = (c && typeof c.country_code === "string")
      ? c.country_code.toUpperCase()
      : null;
    return codeLegacy === countryCode || codeNew === countryCode;
  }) as any | undefined;

  const supportsMomo = country?.supports_momo === true || country?.momo_supported === true;
  if (!supportsMomo) return null;

  // USSD formats by provider
  const ussdFormats: Record<string, string> = {
    "MTN": "*182*8*1*{CODE}#",      // Rwanda MTN MoMo merchant
    "Lumitel": "*889#",              // Burundi
    "Vodacom": "*171#",              // DR Congo
    "M-Pesa": "*150#",               // Tanzania
    "Airtel": "*778#",               // Zambia
  };

  const provider: string | undefined = country?.momo_provider;
  if (!provider) return null;
  const format = ussdFormats[provider];
  if (!format) return null;
  return { provider, ussdFormat: format };
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
    .select("*");

  const rows = (countries || []).filter((c: any) => {
    const flag = c[column];
    if (flag === true) return true;
    // Support legacy flag name for momo
    if (column === "supports_momo" && c.momo_supported === true) return true;
    return false;
  });

  return rows.map((c: any) => c.country_name ?? c.name).filter(Boolean);
}
