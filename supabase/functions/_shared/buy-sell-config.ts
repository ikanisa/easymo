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
  if (!phone.startsWith("+")) {
    return `+${digits}`;
  }

  return phone;
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
}

/**
 * Check if country code is blocked
 * @param countryCode Two-letter country code
 * @returns true if blocked, false otherwise
 */
export function isCountryBlocked(countryCode: string): boolean {
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
}
