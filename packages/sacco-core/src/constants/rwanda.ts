/**
 * Rwanda provinces
 */
export const RWANDA_PROVINCES = [
  "Kigali City",
  "Eastern Province",
  "Northern Province",
  "Southern Province",
  "Western Province",
] as const;

export type RwandaProvince = typeof RWANDA_PROVINCES[number];

/**
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
] as const;

export type RwandaDistrict = typeof RWANDA_DISTRICTS[number];

/**
 * Mobile money providers in Rwanda
 */
export const MOBILE_MONEY_PROVIDERS = {
  MTN: "MTN Mobile Money",
  AIRTEL: "Airtel Money",
} as const;

export type MobileMoneyProvider = keyof typeof MOBILE_MONEY_PROVIDERS;
