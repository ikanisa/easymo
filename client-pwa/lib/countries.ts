/**
 * Countries Service
 * Fetches country data from Supabase - NO HARDCODED DATA
 * Following GROUND_RULES.md: observability, caching
 * 
 * Note: This service uses simple in-memory caching which works well for
 * client-side React applications. For more complex scenarios (SSR, concurrent
 * requests), consider integrating with React Query or SWR at the component level.
 */

import { createClient } from '@/lib/supabase/client';
import type { Country, CountrySelectOption } from '@/types/country';
import { logStructuredEvent } from '@/lib/observability';

// In-memory cache for countries (5 minute TTL)
// This cache is shared across all components in the same page session
let countriesCache: { data: Country[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Map Supabase row to Country type
 */
function mapRowToCountry(row: {
  id: string;
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  phone_prefix: string;
  mobile_money_provider: string;
  mobile_money_brand: string;
  ussd_send_to_phone: string;
  ussd_pay_merchant: string;
  is_active: boolean;
  sort_order: number;
  flag_emoji: string;
  timezone: string;
}): Country {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    phonePrefix: row.phone_prefix,
    mobileMoneyProvider: row.mobile_money_provider,
    mobileMoneyBrand: row.mobile_money_brand,
    ussdSendToPhone: row.ussd_send_to_phone,
    ussdPayMerchant: row.ussd_pay_merchant,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    flagEmoji: row.flag_emoji,
    timezone: row.timezone,
  };
}

/**
 * Fetch all active countries from Supabase
 * Uses caching to minimize API calls
 */
export async function fetchCountries(): Promise<Country[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (countriesCache && countriesCache.expiresAt > now) {
    return countriesCache.data;
  }

  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('countries')
      .select(`
        id,
        code,
        name,
        currency_code,
        currency_symbol,
        phone_prefix,
        mobile_money_provider,
        mobile_money_brand,
        ussd_send_to_phone,
        ussd_pay_merchant,
        is_active,
        sort_order,
        flag_emoji,
        timezone
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      await logStructuredEvent('COUNTRIES_FETCH_ERROR', { error: error.message });
      throw error;
    }

    const countries = (data ?? []).map(mapRowToCountry);
    
    // Update cache
    countriesCache = {
      data: countries,
      expiresAt: now + CACHE_TTL_MS,
    };

    await logStructuredEvent('COUNTRIES_FETCHED', { count: countries.length });
    
    return countries;
  } catch (error) {
    await logStructuredEvent('COUNTRIES_FETCH_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Return cached data if available, even if expired
    if (countriesCache) {
      return countriesCache.data;
    }
    
    throw error;
  }
}

/**
 * Get country by code
 */
export async function getCountryByCode(code: string): Promise<Country | null> {
  const countries = await fetchCountries();
  return countries.find((c) => c.code === code) ?? null;
}

/**
 * Get country by phone prefix
 * Used to detect country from phone number
 */
export async function getCountryByPhonePrefix(phoneNumber: string): Promise<Country | null> {
  const countries = await fetchCountries();
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Sort by prefix length (longest first) to match most specific
  const sortedByPrefix = [...countries].sort(
    (a, b) => b.phonePrefix.replace(/\D/g, '').length - a.phonePrefix.replace(/\D/g, '').length
  );
  
  for (const country of sortedByPrefix) {
    const prefix = country.phonePrefix.replace(/\D/g, '');
    if (digits.startsWith(prefix)) {
      return country;
    }
  }
  
  return null;
}

/**
 * Get mobile money provider for a country
 * One provider per country as per requirements
 */
export async function getMoMoProviderForCountry(countryCode: string): Promise<{
  provider: string;
  brand: string;
  ussdSendToPhone: string;
  ussdPayMerchant: string;
} | null> {
  const country = await getCountryByCode(countryCode);
  if (!country) return null;
  
  return {
    provider: country.mobileMoneyProvider,
    brand: country.mobileMoneyBrand,
    ussdSendToPhone: country.ussdSendToPhone,
    ussdPayMerchant: country.ussdPayMerchant,
  };
}

/**
 * Convert countries to select options format
 */
export function countriesToSelectOptions(countries: Country[]): CountrySelectOption[] {
  return countries.map((country) => ({
    value: country.code,
    label: `${country.flagEmoji} ${country.name}`,
    country,
  }));
}

/**
 * Clear countries cache (for testing or force refresh)
 */
export function clearCountriesCache(): void {
  countriesCache = null;
}
