/**
 * Country type definitions for mobile money support
 * Countries are fetched from Supabase, not hardcoded
 */

export interface Country {
  id: string;
  code: string; // ISO 3166-1 alpha-2 (RW, UG, KE, etc.)
  name: string;
  currencyCode: string;
  currencySymbol: string;
  phonePrefix: string;
  mobileMoneyProvider: string;
  mobileMoneyBrand: string;
  ussdSendToPhone: string;
  ussdPayMerchant: string;
  isActive: boolean;
  sortOrder: number;
  flagEmoji: string;
  timezone: string;
}

export interface CountrySelectOption {
  value: string; // country code
  label: string; // country name with flag
  country: Country;
}

/**
 * User's mobile money configuration
 * Note: momo_country can be DIFFERENT from profile_country
 */
export interface UserMoMoConfig {
  profileCountry: string; // From WhatsApp number during registration
  momoCountry: string; // User-selected country for mobile money (can differ)
  momoNumber: string;
  momoProvider: string; // Auto-determined from momoCountry
}
