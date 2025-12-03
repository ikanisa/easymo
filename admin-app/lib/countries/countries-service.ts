/**
 * Countries Service
 * Fetches country and mobile money provider data from Supabase
 */

import { createClient } from '@/lib/supabase/client';
import type { 
  Country, 
  CountrySelectOption, 
  SupportedCountryCode,
  UserMomoConfig 
} from './types';
import {
  COUNTRY_CURRENCIES,
  COUNTRY_FLAGS,
  COUNTRY_MOMO_BRANDS,
  COUNTRY_NAMES,
  COUNTRY_PHONE_PREFIXES,
  DEFAULT_COUNTRY_CODE,
  isSupportedCountry,
  SUPPORTED_COUNTRY_CODES,
} from './types';

/** Transform database row to Country type */
function transformCountry(row: Record<string, unknown>): Country {
  return {
    id: row.id as string,
    code: row.code as SupportedCountryCode,
    name: row.name as string,
    currencyCode: row.currency_code as string,
    currencySymbol: row.currency_symbol as string,
    phonePrefix: row.phone_prefix as string,
    mobileMoneyProvider: row.mobile_money_provider as string,
    mobileMoneyBrand: row.mobile_money_brand as string,
    ussdSendToPhone: row.ussd_send_to_phone as string,
    ussdPayMerchant: row.ussd_pay_merchant as string,
    flagEmoji: row.flag_emoji as string,
    timezone: row.timezone as string,
    sortOrder: row.sort_order as number,
    isActive: row.is_active as boolean,
  };
}

/** Fetch all supported countries from Supabase */
export async function fetchCountries(): Promise<Country[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching countries:', error);
    // Return fallback data if database not available
    return getFallbackCountries();
  }

  return (data ?? []).map(transformCountry);
}

/** Fetch a single country by code */
export async function fetchCountryByCode(code: string): Promise<Country | null> {
  if (!isSupportedCountry(code)) {
    return null;
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    // Return fallback if not found
    return getFallbackCountryByCode(code);
  }

  return transformCountry(data);
}

/** Get country select options for dropdowns */
export async function getCountrySelectOptions(): Promise<CountrySelectOption[]> {
  const countries = await fetchCountries();
  
  return countries.map(c => ({
    code: c.code,
    name: c.name,
    flagEmoji: c.flagEmoji,
    phonePrefix: c.phonePrefix,
    mobileMoneyBrand: c.mobileMoneyBrand,
    currencyCode: c.currencyCode,
  }));
}

/** Get mobile money config for a user based on their selected country */
export async function getMomoConfigForCountry(
  countryCode: SupportedCountryCode,
  phoneNumber: string
): Promise<UserMomoConfig> {
  const country = await fetchCountryByCode(countryCode);
  
  if (!country) {
    // Fallback to defaults
    return {
      countryCode: DEFAULT_COUNTRY_CODE,
      phoneNumber,
      provider: 'MTN Mobile Money',
      brand: 'MoMo',
      currency: 'RWF',
    };
  }

  return {
    countryCode: country.code,
    phoneNumber,
    provider: country.mobileMoneyProvider,
    brand: country.mobileMoneyBrand,
    currency: country.currencyCode,
  };
}

/** Detect country from phone number prefix */
export function detectCountryFromPhone(phone: string): SupportedCountryCode | null {
  const cleanPhone = phone.replace(/\s/g, '');
  
  for (const code of SUPPORTED_COUNTRY_CODES) {
    const prefix = COUNTRY_PHONE_PREFIXES[code];
    if (cleanPhone.startsWith(prefix)) {
      return code;
    }
  }
  
  return null;
}

/** Format phone number with country prefix */
export function formatPhoneWithPrefix(
  phone: string, 
  countryCode: SupportedCountryCode
): string {
  const cleanPhone = phone.replace(/\s/g, '').replace(/^\+/, '');
  const prefix = COUNTRY_PHONE_PREFIXES[countryCode].replace('+', '');
  
  // If already has prefix, return as-is
  if (cleanPhone.startsWith(prefix)) {
    return `+${cleanPhone}`;
  }
  
  // Remove leading zero if present
  const phoneWithoutZero = cleanPhone.replace(/^0/, '');
  
  return `+${prefix}${phoneWithoutZero}`;
}

/** Format currency amount for a country */
export function formatCurrencyForCountry(
  amount: number,
  countryCode: SupportedCountryCode
): string {
  const currency = COUNTRY_CURRENCIES[countryCode];
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================
// Fallback data (used when DB not available)
// ============================================

function getFallbackCountries(): Country[] {
  return SUPPORTED_COUNTRY_CODES.map((code, index) => ({
    id: `fallback-${code}`,
    code,
    name: COUNTRY_NAMES[code],
    currencyCode: COUNTRY_CURRENCIES[code],
    currencySymbol: COUNTRY_CURRENCIES[code],
    phonePrefix: COUNTRY_PHONE_PREFIXES[code],
    mobileMoneyProvider: getMomoProvider(code),
    mobileMoneyBrand: COUNTRY_MOMO_BRANDS[code],
    ussdSendToPhone: '',
    ussdPayMerchant: '',
    flagEmoji: COUNTRY_FLAGS[code],
    timezone: getTimezone(code),
    sortOrder: index + 1,
    isActive: true,
  }));
}

function getFallbackCountryByCode(code: string): Country | null {
  if (!isSupportedCountry(code)) return null;
  
  const index = SUPPORTED_COUNTRY_CODES.indexOf(code);
  return {
    id: `fallback-${code}`,
    code,
    name: COUNTRY_NAMES[code],
    currencyCode: COUNTRY_CURRENCIES[code],
    currencySymbol: COUNTRY_CURRENCIES[code],
    phonePrefix: COUNTRY_PHONE_PREFIXES[code],
    mobileMoneyProvider: getMomoProvider(code),
    mobileMoneyBrand: COUNTRY_MOMO_BRANDS[code],
    ussdSendToPhone: '',
    ussdPayMerchant: '',
    flagEmoji: COUNTRY_FLAGS[code],
    timezone: getTimezone(code),
    sortOrder: index + 1,
    isActive: true,
  };
}

function getMomoProvider(code: SupportedCountryCode): string {
  const providers: Record<SupportedCountryCode, string> = {
    RW: 'MTN Mobile Money',
    CD: 'Orange Money',
    BI: 'Econet EcoCash',
    TZ: 'Vodacom M-Pesa',
  };
  return providers[code];
}

function getTimezone(code: SupportedCountryCode): string {
  const timezones: Record<SupportedCountryCode, string> = {
    RW: 'Africa/Kigali',
    CD: 'Africa/Kinshasa',
    BI: 'Africa/Bujumbura',
    TZ: 'Africa/Dar_es_Salaam',
  };
  return timezones[code];
}
