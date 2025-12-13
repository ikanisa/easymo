/**
 * Buy & Sell Agent Configuration and Phone Utilities
 * 
 * Configuration for regional operations and phone number utilities:
 * - African country codes mapping
 * - Blocked countries (geo-blocking)
 * - Market configurations
 * - Phone number normalization
 * - Country detection from phone
 */

// African country codes mapping (prefix to ISO code)
export const AFRICAN_COUNTRY_CODES: Record<string, string> = {
  "237": "CM", // Cameroon
  "225": "CI", // Côte d'Ivoire
  "233": "GH", // Ghana
  "234": "NG", // Nigeria
  "254": "KE", // Kenya
  "255": "TZ", // Tanzania
  "256": "UG", // Uganda
  "250": "RW", // Rwanda
  "257": "BI", // Burundi
  "243": "CD", // DR Congo
  "242": "CG", // Congo
  "221": "SN", // Senegal
  "223": "ML", // Mali
  "226": "BF", // Burkina Faso
  "227": "NE", // Niger
  "228": "TG", // Togo
  "229": "BJ", // Benin
  "231": "LR", // Liberia
  "232": "SL", // Sierra Leone
  "235": "TD", // Chad
  "236": "CF", // Central African Republic
  "238": "CV", // Cape Verde
  "239": "ST", // São Tomé and Príncipe
  "240": "GQ", // Equatorial Guinea
  "241": "GA", // Gabon
  "244": "AO", // Angola
  "245": "GW", // Guinea-Bissau
  "246": "IO", // British Indian Ocean Territory
  "248": "SC", // Seychelles
  "249": "SD", // Sudan
  "251": "ET", // Ethiopia
  "252": "SO", // Somalia
  "253": "DJ", // Djibouti
  "258": "MZ", // Mozambique
  "260": "ZM", // Zambia
  "261": "MG", // Madagascar
  "262": "RE", // Réunion
  "263": "ZW", // Zimbabwe
  "264": "NA", // Namibia
  "265": "MW", // Malawi
  "266": "LS", // Lesotho
  "267": "BW", // Botswana
  "268": "SZ", // Eswatini
  "269": "KM", // Comoros
  "27": "ZA",  // South Africa
};

// Blocked countries for vendor outreach (as per requirements)
export const BLOCKED_COUNTRIES = ["UG", "KE", "NG", "ZA"];

// Market configuration
export interface MarketConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  timezone: string;
  enabled: boolean;
}

export const MARKET_CONFIG: Record<string, MarketConfig> = {
  CM: {
    countryCode: "CM",
    countryName: "Cameroon",
    currency: "XAF",
    timezone: "Africa/Douala",
    enabled: true
  },
  RW: {
    countryCode: "RW",
    countryName: "Rwanda",
    currency: "RWF",
    timezone: "Africa/Kigali",
    enabled: true
  },
  TZ: {
    countryCode: "TZ",
    countryName: "Tanzania",
    currency: "TZS",
    timezone: "Africa/Dar_es_Salaam",
    enabled: true
  },
  // Blocked countries (for reference only)
  UG: {
    countryCode: "UG",
    countryName: "Uganda",
    currency: "UGX",
    timezone: "Africa/Kampala",
    enabled: false
  },
  KE: {
    countryCode: "KE",
    countryName: "Kenya",
    currency: "KES",
    timezone: "Africa/Nairobi",
    enabled: false
  },
  NG: {
    countryCode: "NG",
    countryName: "Nigeria",
    currency: "NGN",
    timezone: "Africa/Lagos",
    enabled: false
  },
  ZA: {
    countryCode: "ZA",
    countryName: "South Africa",
    currency: "ZAR",
    timezone: "Africa/Johannesburg",
    enabled: false
  }
};

/**
 * Normalize phone number to E.164 format
 * 
 * Examples:
 * - "0788123456" (RW) -> "+250788123456"
 * - "+250788123456" -> "+250788123456"
 * - "788123456" (RW) -> "+250788123456"
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode: string = "250"): string {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with +, remove it for now
  const hasPlus = phone.startsWith("+");

  // If starts with 0, remove it (local format)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with country code, add default
  const startsWithCountryCode = Object.keys(AFRICAN_COUNTRY_CODES).some(
    code => cleaned.startsWith(code)
  );

  if (!startsWithCountryCode) {
    cleaned = defaultCountryCode + cleaned;
  }

  // Always return with + prefix
  return "+" + cleaned;
}

/**
 * Get country from phone number
 * 
 * Examples:
 * - "+250788123456" -> "RW"
 * - "+234123456789" -> "NG"
 * - "+1234567890" -> null
 */
export function getCountryFromPhone(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone);
  
  // Remove + sign
  const cleaned = normalized.replace(/^\+/, "");

  // Try to match country codes (longest first for proper matching)
  const sortedCodes = Object.keys(AFRICAN_COUNTRY_CODES)
    .sort((a, b) => b.length - a.length);

  for (const code of sortedCodes) {
    if (cleaned.startsWith(code)) {
      return AFRICAN_COUNTRY_CODES[code];
    }
  }

  return null;
}

/**
 * Check if phone number is from a blocked country
 */
export function isBlockedPhone(phone: string): boolean {
  const country = getCountryFromPhone(phone);
  return country ? BLOCKED_COUNTRIES.includes(country) : false;
}

/**
 * Check if country code is blocked
 */
export function isBlockedCountry(countryCode: string): boolean {
  return BLOCKED_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Get market config for a phone number
 */
export function getMarketConfig(phone: string): MarketConfig | null {
  const country = getCountryFromPhone(phone);
  return country ? MARKET_CONFIG[country] || null : null;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic validation: should start with + and have 10-15 digits
  return /^\+\d{10,15}$/.test(normalized);
}

/**
 * Format phone number for display
 * 
 * Examples:
 * - "+250788123456" -> "+250 788 123 456"
 * - "+234123456789" -> "+234 123 456 789"
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const cleaned = normalized.replace(/^\+/, "");
  
  // Get country code
  const country = getCountryFromPhone(normalized);
  if (!country) return normalized;

  // Find the country code length
  let codeLength = 0;
  for (const [code, iso] of Object.entries(AFRICAN_COUNTRY_CODES)) {
    if (iso === country) {
      codeLength = code.length;
      break;
    }
  }

  const countryCode = cleaned.substring(0, codeLength);
  const number = cleaned.substring(codeLength);

  // Format: +XXX XXX XXX XXX
  const parts = number.match(/.{1,3}/g) || [];
  return `+${countryCode} ${parts.join(" ")}`;
}
