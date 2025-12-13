/**
 * Buy & Sell Configuration
 * 
 * African country code mappings and geo-blocking utilities
 */

// African country phone prefixes (without + sign)
export const AFRICAN_COUNTRY_CODES: Record<string, string> = {
  "250": "RW", // Rwanda
  "254": "KE", // Kenya
  "255": "TZ", // Tanzania
  "256": "UG", // Uganda
  "234": "NG", // Nigeria
  "27": "ZA",  // South Africa
  "233": "GH", // Ghana
  "237": "CM", // Cameroon
  "251": "ET", // Ethiopia
  "252": "SO", // Somalia
  "253": "DJ", // Djibouti
  "257": "BI", // Burundi
  "258": "MZ", // Mozambique
  "260": "ZM", // Zambia
  "261": "MG", // Madagascar
  "263": "ZW", // Zimbabwe
  "265": "MW", // Malawi
  "267": "BW", // Botswana
  "268": "SZ", // Eswatini
  "269": "KM", // Comoros
  "211": "SS", // South Sudan
  "212": "MA", // Morocco
  "213": "DZ", // Algeria
  "216": "TN", // Tunisia
  "218": "LY", // Libya
  "220": "GM", // Gambia
  "221": "SN", // Senegal
  "222": "MR", // Mauritania
  "223": "ML", // Mali
  "224": "GN", // Guinea
  "225": "CI", // Côte d'Ivoire
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
  "230": "MU", // Mauritius
  "231": "LR", // Liberia
  "232": "SL", // Sierra Leone
  "235": "TD", // Chad
  "236": "CF", // Central African Republic
  "238": "CV", // Cape Verde
  "239": "ST", // São Tomé and Príncipe
  "240": "GQ", // Equatorial Guinea
  "241": "GA", // Gabon
  "242": "CG", // Republic of the Congo
  "243": "CD", // Democratic Republic of the Congo
  "244": "AO", // Angola
  "245": "GW", // Guinea-Bissau
  "246": "IO", // British Indian Ocean Territory
  "248": "SC", // Seychelles
  "249": "SD", // Sudan
};

// Blocked countries for Buy & Sell agent (as per source requirements)
export const BLOCKED_COUNTRIES = ["UG", "KE", "NG", "ZA"];

/**
 * Normalize phone number to E.164 format
 * @param phone Phone number in various formats
 * @returns Normalized phone number with + prefix
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // If starts with 00, replace with +
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Ensure it starts with +
  return `+${digits}`;
}

/**
 * Detect country code from phone number
 * @param phone Phone number
 * @returns Two-letter country code or null if not found
 */
export function detectCountryFromPhone(phone: string): string | null {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, "");

  // Try matching prefixes from longest to shortest
  for (let i = 3; i >= 2; i--) {
    const prefix = digits.substring(0, i);
    if (AFRICAN_COUNTRY_CODES[prefix]) {
      return AFRICAN_COUNTRY_CODES[prefix];
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
 * @param phone Phone number
 * @returns true if blocked, false otherwise
 */
export function isPhoneBlocked(phone: string): boolean {
  const country = detectCountryFromPhone(phone);
  return country !== null && BLOCKED_COUNTRIES.includes(country);
 */
export function isBlockedPhone(phone: string): boolean {
  const country = getCountryFromPhone(phone);
  return country ? BLOCKED_COUNTRIES.includes(country) : false;
}

/**
 * Check if country code is blocked
 * @param countryCode Two-letter country code
 * @returns true if blocked, false otherwise
 */
export function isCountryBlocked(countryCode: string): boolean {
 */
export function isBlockedCountry(countryCode: string): boolean {
  return BLOCKED_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Format phone number for display (mask middle digits)
 * @param phone Phone number
 * @returns Masked phone number
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) {
    return normalized;
  }
  return normalized.replace(/(\+\d{3})\d+(\d{4})/, "$1****$2");
}

/**
 * Get country name from country code
 * @param countryCode Two-letter country code
 * @returns Country name or null if not found
 */
export function getCountryName(countryCode: string): string | null {
  const countryNames: Record<string, string> = {
    RW: "Rwanda",
    KE: "Kenya",
    TZ: "Tanzania",
    UG: "Uganda",
    NG: "Nigeria",
    ZA: "South Africa",
    GH: "Ghana",
    CM: "Cameroon",
    ET: "Ethiopia",
    SO: "Somalia",
    DJ: "Djibouti",
    BI: "Burundi",
    MZ: "Mozambique",
    ZM: "Zambia",
    MG: "Madagascar",
    ZW: "Zimbabwe",
    MW: "Malawi",
    BW: "Botswana",
    SZ: "Eswatini",
    KM: "Comoros",
    SS: "South Sudan",
  };

  return countryNames[countryCode.toUpperCase()] || null;
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
