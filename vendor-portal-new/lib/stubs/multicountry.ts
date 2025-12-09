import type { CountryConfig, CountryRow, TelcoProvider } from "@/lib/types/multicountry";

interface PartnerOrg {
  id: string;
  name: string;
  type: string;
  country_id: string;
  countries: { name: string; iso2: string } | null;
  district_code?: string | null;
}

interface PartnerConfigSnapshot {
  org_id: string;
  enabled_features: string[];
  merchant_code: string | null;
  telco_ids: string[];
  language_pack: string[];
  reference_prefix: string | null;
  contact: {
    phone: string | null;
    email: string | null;
    hours: string | null;
  } | null;
  updated_at: string;
}

interface CountryConfigSnapshot extends CountryConfig {
  updated_at: string;
}

interface CountryStubEntry {
  country: CountryRow;
  config: CountryConfigSnapshot;
  telcos: Array<Pick<TelcoProvider, "id" | "name" | "ussd_pattern">>;
}

interface PartnerStubEntry {
  org: PartnerOrg;
  config: PartnerConfigSnapshot;
  telcos: Array<Pick<TelcoProvider, "id" | "name" | "ussd_pattern">>;
}

type MulticountryStubState = {
  countries: Record<string, CountryStubEntry>;
  partners: Record<string, PartnerStubEntry>;
};

const GLOBAL_STATE_KEY = Symbol.for("ibimina.multicountry.stub");

function createDefaultState(): MulticountryStubState {
  const now = new Date().toISOString();

  const country: CountryRow = {
    id: "stub-country-rw",
    iso2: "RW",
    iso3: "RWA",
    name: "Rwanda",
    default_locale: "rw-RW",
    currency_code: "RWF",
    timezone: "Africa/Kigali",
    is_active: true,
  };

  const countryConfig: CountryConfigSnapshot = {
    country_id: country.id,
    languages: ["rw-RW", "en-RW"],
    enabled_features: ["USSD", "SMS_INGEST", "OCR"],
    kyc_required_docs: { national_id: true, selfie: true },
    legal_pages: {
      terms: "https://example.com/terms",
      privacy: "https://example.com/privacy",
    },
    telco_ids: ["stub-mtn-rw", "stub-airtel-rw"],
    reference_format: "C3.D3.S3.G4.M3",
    number_format: { countryCode: "+250" },
    settlement_notes:
      "Reconcile MoMo collections with SACCO ledger daily. Escalate unmatched deposits after 48 hours.",
    updated_at: now,
  };

  const telcos: Array<Pick<TelcoProvider, "id" | "name" | "ussd_pattern">> = [
    { id: "stub-mtn-rw", name: "MTN Rwanda", ussd_pattern: "*182#" },
    { id: "stub-airtel-rw", name: "Airtel Money", ussd_pattern: "*182#" },
  ];

  const org: PartnerOrg = {
    id: "stub-partner-amahoro",
    name: "Amahoro SACCO",
    type: "SACCO",
    country_id: country.id,
    countries: { name: country.name, iso2: country.iso2 },
    district_code: "KIGALI",
  };

  const partnerConfig: PartnerConfigSnapshot = {
    org_id: org.id,
    enabled_features: ["SMS_INGEST"],
    merchant_code: "123456",
    telco_ids: countryConfig.telco_ids.slice(0, 1),
    language_pack: ["rw-RW"],
    reference_prefix: "AMA",
    contact: {
      phone: "+250788000000",
      email: "support@amahoro.rw",
      hours: "Mon-Fri 08:00-17:00",
    },
    updated_at: now,
  };

  return {
    countries: {
      [country.id]: {
        country,
        config: countryConfig,
        telcos,
      },
    },
    partners: {
      [org.id]: {
        org,
        config: partnerConfig,
        telcos,
      },
    },
  } satisfies MulticountryStubState;
}

function getMutableState(): MulticountryStubState {
  const globalScope = globalThis as unknown as {
    [GLOBAL_STATE_KEY]?: MulticountryStubState;
  };

  if (!globalScope[GLOBAL_STATE_KEY]) {
    globalScope[GLOBAL_STATE_KEY] = createDefaultState();
  }

  return globalScope[GLOBAL_STATE_KEY]!;
}

export function listStubCountries(): CountryStubEntry[] {
  return Object.values(getMutableState().countries);
}

export function getStubCountry(countryId: string): CountryStubEntry | null {
  const state = getMutableState();
  return state.countries[countryId] ?? null;
}

export function upsertStubCountryConfig(
  countryId: string,
  updates: Partial<
    Pick<CountryConfigSnapshot, "reference_format" | "settlement_notes" | "enabled_features">
  >
): CountryConfigSnapshot {
  const state = getMutableState();
  const existing = state.countries[countryId];

  if (!existing) {
    throw new Error(`Unknown stub country ${countryId}`);
  }

  const next: CountryConfigSnapshot = {
    ...existing.config,
    ...updates,
    reference_format: updates.reference_format ?? existing.config.reference_format,
    settlement_notes:
      updates.settlement_notes === undefined
        ? existing.config.settlement_notes
        : updates.settlement_notes,
    enabled_features: updates.enabled_features ?? existing.config.enabled_features,
    updated_at: new Date().toISOString(),
  };

  state.countries[countryId] = {
    ...existing,
    config: next,
  };

  return next;
}

export function listStubPartners(): PartnerStubEntry[] {
  return Object.values(getMutableState().partners);
}

export function getStubPartner(partnerId: string): PartnerStubEntry | null {
  const state = getMutableState();
  return state.partners[partnerId] ?? null;
}

export function upsertStubPartnerConfig(
  partnerId: string,
  updates: Partial<
    Pick<
      PartnerConfigSnapshot,
      "enabled_features" | "merchant_code" | "reference_prefix" | "language_pack" | "contact"
    >
  >
): PartnerConfigSnapshot {
  const state = getMutableState();
  const existing = state.partners[partnerId];

  if (!existing) {
    throw new Error(`Unknown stub partner ${partnerId}`);
  }

  const next: PartnerConfigSnapshot = {
    ...existing.config,
    ...updates,
    merchant_code: updates.merchant_code ?? existing.config.merchant_code,
    reference_prefix: updates.reference_prefix ?? existing.config.reference_prefix,
    enabled_features: updates.enabled_features ?? existing.config.enabled_features,
    language_pack: updates.language_pack ?? existing.config.language_pack,
    contact: updates.contact ?? existing.config.contact,
    updated_at: new Date().toISOString(),
  };

  state.partners[partnerId] = {
    ...existing,
    config: next,
  };

  return next;
}

export type { CountryStubEntry, PartnerStubEntry };
