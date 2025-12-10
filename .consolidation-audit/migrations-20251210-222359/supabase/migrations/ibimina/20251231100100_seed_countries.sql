-- Seed Countries Data
-- Initial country setup with Rwanda as default market
-- Additional countries can be activated via admin interface

-- =============================================================================
-- 1. INSERT INITIAL COUNTRIES
-- =============================================================================

-- Rwanda (Primary/Default Market)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'RW',
  'RWA',
  'Rwanda',
  'rw-RW',
  'RWF',
  'Africa/Kigali',
  true
)
ON CONFLICT (iso2) DO UPDATE SET
  name = EXCLUDED.name,
  default_locale = EXCLUDED.default_locale,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active;

-- Senegal (French-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'SN',
  'SEN',
  'Senegal',
  'fr-SN',
  'XOF',
  'Africa/Dakar',
  false  -- Not active by default, enable when ready
)
ON CONFLICT (iso2) DO NOTHING;

-- Côte d'Ivoire (French-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'CI',
  'CIV',
  'Côte d''Ivoire',
  'fr-CI',
  'XOF',
  'Africa/Abidjan',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Ghana (English-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'GH',
  'GHA',
  'Ghana',
  'en-GH',
  'GHS',
  'Africa/Accra',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Zambia (English-speaking Southern Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'ZM',
  'ZMB',
  'Zambia',
  'en-ZM',
  'ZMW',
  'Africa/Lusaka',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Malawi (English-speaking Southern Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'MW',
  'MWI',
  'Malawi',
  'en-MW',
  'MWK',
  'Africa/Blantyre',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Tanzania (English-speaking East Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'TZ',
  'TZA',
  'Tanzania',
  'en-TZ',
  'TZS',
  'Africa/Dar_es_Salaam',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Burundi (French-speaking Central Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'BI',
  'BDI',
  'Burundi',
  'fr-BI',
  'BIF',
  'Africa/Bujumbura',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Democratic Republic of Congo (French-speaking Central Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'CD',
  'COD',
  'Democratic Republic of Congo',
  'fr-CD',
  'CDF',
  'Africa/Kinshasa',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- =============================================================================
-- 2. INSERT RWANDA TELECOM PROVIDERS
-- =============================================================================

-- Get Rwanda country_id
DO $$
DECLARE
  rwanda_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  
  -- MTN Rwanda
  INSERT INTO public.telco_providers (country_id, name, ussd_pattern, merchant_field_name, reference_field_name, notes, is_active)
  VALUES (
    rwanda_id,
    'MTN Rwanda',
    '*182*8*1#',
    'merchant',
    'reference',
    'MTN Mobile Money - Primary provider',
    true
  )
  ON CONFLICT (country_id, name) DO UPDATE SET
    ussd_pattern = EXCLUDED.ussd_pattern,
    is_active = EXCLUDED.is_active;
  
  -- Airtel Rwanda
  INSERT INTO public.telco_providers (country_id, name, ussd_pattern, merchant_field_name, reference_field_name, notes, is_active)
  VALUES (
    rwanda_id,
    'Airtel Rwanda',
    '*500#',
    'merchant',
    'reference',
    'Airtel Money',
    true
  )
  ON CONFLICT (country_id, name) DO NOTHING;
END $$;

-- =============================================================================
-- 3. CREATE RWANDA COUNTRY CONFIGURATION
-- =============================================================================

-- Set up Rwanda country config with telco provider IDs
DO $$
DECLARE
  rwanda_id UUID;
  mtn_id UUID;
  airtel_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  SELECT id INTO mtn_id FROM public.telco_providers WHERE country_id = rwanda_id AND name = 'MTN Rwanda';
  SELECT id INTO airtel_id FROM public.telco_providers WHERE country_id = rwanda_id AND name = 'Airtel Rwanda';
  
  INSERT INTO public.country_config (
    country_id,
    languages,
    enabled_features,
    kyc_required_docs,
    legal_pages,
    telco_ids,
    reference_format,
    number_format
  )
  VALUES (
    rwanda_id,
    ARRAY['rw-RW', 'en-RW', 'fr-RW'],
    ARRAY['USSD', 'OCR', 'SMS_INGEST', 'STATEMENT_UPLOAD', 'MANUAL_ENTRY'],
    jsonb_build_object(
      'NID', true,
      'Selfie', true,
      'ProofOfAddress', false,
      'Passport', false
    ),
    jsonb_build_object(
      'terms', jsonb_build_object(
        'rw-RW', '/legal/terms?lang=rw',
        'en-RW', '/legal/terms?lang=en',
        'fr-RW', '/legal/terms?lang=fr'
      ),
      'privacy', jsonb_build_object(
        'rw-RW', '/legal/privacy?lang=rw',
        'en-RW', '/legal/privacy?lang=en',
        'fr-RW', '/legal/privacy?lang=fr'
      )
    ),
    ARRAY[mtn_id, airtel_id],
    'C3.D3.S3.G4.M3',
    jsonb_build_object(
      'pattern', '^(250)?[0-9]{9}$',
      'prefix', '250',
      'format', '+250 XXX XXX XXX'
    )
  )
  ON CONFLICT (country_id) DO UPDATE SET
    languages = EXCLUDED.languages,
    enabled_features = EXCLUDED.enabled_features,
    kyc_required_docs = EXCLUDED.kyc_required_docs,
    legal_pages = EXCLUDED.legal_pages,
    telco_ids = EXCLUDED.telco_ids,
    reference_format = EXCLUDED.reference_format,
    number_format = EXCLUDED.number_format;
END $$;

-- =============================================================================
-- 4. LINK EXISTING DATA TO RWANDA
-- =============================================================================

-- Update existing organizations to link to Rwanda
DO $$
DECLARE
  rwanda_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  
  -- Update organizations without country_id
  UPDATE public.organizations
  SET country_id = rwanda_id
  WHERE country_id IS NULL;
  
  -- Update app.saccos without country_id (via org_id or directly)
  UPDATE app.saccos s
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.ikimina without country_id
  UPDATE app.ikimina i
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.members without country_id
  UPDATE app.members m
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.payments without country_id
  UPDATE app.payments p
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.import_files without country_id
  UPDATE app.import_files f
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.sms_inbox without country_id
  UPDATE app.sms_inbox s
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
END $$;

-- =============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.countries IS 'Supported countries - Rwanda is primary market, others are expansion markets';
COMMENT ON TABLE public.country_config IS 'Country-specific configurations - Rwanda config includes MTN and Airtel providers';

-- =============================================================================
-- END OF SEED MIGRATION
-- =============================================================================
