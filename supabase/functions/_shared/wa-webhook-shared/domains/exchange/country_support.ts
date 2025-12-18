import type { SupabaseClient } from "../../deps.ts";

export type CountrySupportResult = {
  countryCode: string | null;
  countryName: string | null;
  momoSupported: boolean;
};

/**
 * Check country support for phone number (Rwanda-only system)
 * Always returns Rwanda support with MoMo enabled
 */
export async function checkCountrySupport(
  _supabase: SupabaseClient,
  phoneNumber: string,
): Promise<CountrySupportResult> {
  const digits = phoneNumber.replace(/\D/g, "");
  
  // Rwanda-only system - check if phone starts with 250
  if (digits.startsWith("250")) {
    return {
      countryCode: "RW",
      countryName: "Rwanda",
      momoSupported: true,
    };
  }
  
  // Default: not supported (Rwanda-only system)
  return {
    countryCode: null,
    countryName: null,
    momoSupported: false,
  };
}

export function resetCountrySupportCache(): void {
  // No cache needed for Rwanda-only system
}

export type MomoProvider = {
  name: string;
  ussdFormat: string | null;
};

/**
 * Get MoMo provider configuration for a phone number (Rwanda-only)
 * Returns null to use default USSD codes
 */
export async function getMomoProvider(
  _supabase: SupabaseClient,
  _phoneNumber: string,
): Promise<MomoProvider | null> {
  // Rwanda-only system - use default USSD codes
  return null;
}
