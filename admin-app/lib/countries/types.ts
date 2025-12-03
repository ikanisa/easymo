/**
 * Countries Types
 * EasyMO supports exactly 4 countries: RW, CD, BI, TZ
 */

/** Supported country codes - DO NOT add other countries */
export type SupportedCountryCode = 'RW' | 'CD' | 'BI' | 'TZ';

/** Array of supported country codes for validation */
export const SUPPORTED_COUNTRY_CODES: SupportedCountryCode[] = ['RW', 'CD', 'BI', 'TZ'];

/** Default country code */
export const DEFAULT_COUNTRY_CODE: SupportedCountryCode = 'RW';

export interface Country {
  id: string;
  code: SupportedCountryCode;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  phonePrefix: string;
  mobileMoneyProvider: string;
  mobileMoneyBrand: string;
  ussdSendToPhone: string;
  ussdPayMerchant: string;
  flagEmoji: string;
  timezone: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CountrySelectOption {
  code: SupportedCountryCode;
  name: string;
  flagEmoji: string;
  phonePrefix: string;
  mobileMoneyBrand: string;
  currencyCode: string;
}

/** User's mobile money configuration */
export interface UserMomoConfig {
  countryCode: SupportedCountryCode;
  phoneNumber: string;
  provider: string;
  brand: string;
  currency: string;
}

/** Check if a country code is supported */
export function isSupportedCountry(code: string): code is SupportedCountryCode {
  return SUPPORTED_COUNTRY_CODES.includes(code as SupportedCountryCode);
}

/** Get phone prefix for a country */
export const COUNTRY_PHONE_PREFIXES: Record<SupportedCountryCode, string> = {
  RW: '+250',
  CD: '+243',
  BI: '+257',
  TZ: '+255',
};

/** Get currency for a country */
export const COUNTRY_CURRENCIES: Record<SupportedCountryCode, string> = {
  RW: 'RWF',
  CD: 'CDF',
  BI: 'BIF',
  TZ: 'TZS',
};

/** Get mobile money brand for a country */
export const COUNTRY_MOMO_BRANDS: Record<SupportedCountryCode, string> = {
  RW: 'MoMo',
  CD: 'Orange Money',
  BI: 'EcoCash',
  TZ: 'M-Pesa',
};

/** Get flag emoji for a country */
export const COUNTRY_FLAGS: Record<SupportedCountryCode, string> = {
  RW: '🇷🇼',
  CD: '🇨🇩',
  BI: '🇧🇮',
  TZ: '🇹🇿',
};

/** Get country name */
export const COUNTRY_NAMES: Record<SupportedCountryCode, string> = {
  RW: 'Rwanda',
  CD: 'DR Congo',
  BI: 'Burundi',
  TZ: 'Tanzania',
};
