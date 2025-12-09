/**
<<<<<<< HEAD
 * Rwanda administrative divisions
 * Source: National Institute of Statistics of Rwanda (NISR)
 */

export const RWANDA_PROVINCES = [
  'Kigali City',
  'Eastern Province',
  'Northern Province',
  'Southern Province',
  'Western Province',
=======
 * Rwanda provinces
 */
export const RWANDA_PROVINCES = [
  "Kigali City",
  "Eastern Province",
  "Northern Province",
  "Southern Province",
  "Western Province",
>>>>>>> feature/location-caching-and-mobility-deep-review
] as const;

export type RwandaProvince = typeof RWANDA_PROVINCES[number];

/**
<<<<<<< HEAD
 * Major districts in Rwanda (30 districts)
 */
export const RWANDA_DISTRICTS = [
  // Kigali City
  'Gasabo',
  'Kicukiro',
  'Nyarugenge',
  
  // Eastern Province
  'Bugesera',
  'Gatsibo',
  'Kayonza',
  'Kirehe',
  'Ngoma',
  'Nyagatare',
  'Rwamagana',
  
  // Northern Province
  'Burera',
  'Gakenke',
  'Gicumbi',
  'Musanze',
  'Rulindo',
  
  // Southern Province
  'Gisagara',
  'Huye',
  'Kamonyi',
  'Muhanga',
  'Nyamagabe',
  'Nyanza',
  'Nyaruguru',
  'Ruhango',
  
  // Western Province
  'Karongi',
  'Ngororero',
  'Nyabihu',
  'Nyamasheke',
  'Rubavu',
  'Rusizi',
  'Rutsiro',
=======
 * Rwanda districts (selected major ones)
 */
export const RWANDA_DISTRICTS = [
  "Gasabo",
  "Kicukiro",
  "Nyarugenge",
  "Bugesera",
  "Gatsibo",
  "Kayonza",
  "Kirehe",
  "Ngoma",
  "Nyagatare",
  "Rwamagana",
  "Burera",
  "Gicumbi",
  "Musanze",
  "Rulindo",
  "Gakenke",
  "Gisagara",
  "Huye",
  "Kamonyi",
  "Muhanga",
  "Nyamagabe",
  "Nyanza",
  "Nyaruguru",
  "Ruhango",
  "Karongi",
  "Ngororero",
  "Nyabihu",
  "Nyamasheke",
  "Rubavu",
  "Rusizi",
  "Rutsiro",
>>>>>>> feature/location-caching-and-mobility-deep-review
] as const;

export type RwandaDistrict = typeof RWANDA_DISTRICTS[number];

/**
<<<<<<< HEAD
 * District to Province mapping
 */
export const DISTRICT_TO_PROVINCE: Record<RwandaDistrict, RwandaProvince> = {
  // Kigali City
  'Gasabo': 'Kigali City',
  'Kicukiro': 'Kigali City',
  'Nyarugenge': 'Kigali City',
  
  // Eastern Province
  'Bugesera': 'Eastern Province',
  'Gatsibo': 'Eastern Province',
  'Kayonza': 'Eastern Province',
  'Kirehe': 'Eastern Province',
  'Ngoma': 'Eastern Province',
  'Nyagatare': 'Eastern Province',
  'Rwamagana': 'Eastern Province',
  
  // Northern Province
  'Burera': 'Northern Province',
  'Gakenke': 'Northern Province',
  'Gicumbi': 'Northern Province',
  'Musanze': 'Northern Province',
  'Rulindo': 'Northern Province',
  
  // Southern Province
  'Gisagara': 'Southern Province',
  'Huye': 'Southern Province',
  'Kamonyi': 'Southern Province',
  'Muhanga': 'Southern Province',
  'Nyamagabe': 'Southern Province',
  'Nyanza': 'Southern Province',
  'Nyaruguru': 'Southern Province',
  'Ruhango': 'Southern Province',
  
  // Western Province
  'Karongi': 'Western Province',
  'Ngororero': 'Western Province',
  'Nyabihu': 'Western Province',
  'Nyamasheke': 'Western Province',
  'Rubavu': 'Western Province',
  'Rusizi': 'Western Province',
  'Rutsiro': 'Western Province',
};

/**
 * Get province for a given district
 */
export function getProvinceForDistrict(district: RwandaDistrict): RwandaProvince {
  return DISTRICT_TO_PROVINCE[district];
}

/**
 * Validate if a district is valid
 */
export function isValidDistrict(district: string): district is RwandaDistrict {
  return RWANDA_DISTRICTS.includes(district as RwandaDistrict);
}

/**
 * Validate if a province is valid
 */
export function isValidProvince(province: string): province is RwandaProvince {
  return RWANDA_PROVINCES.includes(province as RwandaProvince);
}
=======
 * Mobile money providers in Rwanda
 */
export const MOBILE_MONEY_PROVIDERS = {
  MTN: "MTN Mobile Money",
  AIRTEL: "Airtel Money",
} as const;

export type MobileMoneyProvider = keyof typeof MOBILE_MONEY_PROVIDERS;
>>>>>>> feature/location-caching-and-mobility-deep-review
