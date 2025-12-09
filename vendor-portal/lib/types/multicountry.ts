// Multi-country types for admin UI

export interface CountryRow {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  default_locale: string;
  currency_code: string;
  timezone: string;
  is_active: boolean;
}

export interface TelcoProvider {
  id: string;
  country_id: string;
  name: string;
  ussd_pattern: string;
  merchant_field_name: string;
  reference_field_name: string;
  notes?: string;
}

export interface CountryConfig {
  country_id: string;
  languages: string[];
  enabled_features: string[];
  kyc_required_docs: Record<string, boolean>;
  legal_pages: {
    terms: string;
    privacy: string;
  };
  telco_ids: string[];
  reference_format: string;
  number_format?: any;
  settlement_notes?: string;
}

export interface PartnerConfig {
  org_id: string;
  enabled_features?: string[];
  merchant_code?: string;
  telco_ids?: string[];
  language_pack?: string[];
  reference_prefix?: string;
  contact?: {
    phone?: string;
    email?: string;
    hours?: string;
  };
}
