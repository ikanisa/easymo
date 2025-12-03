-- =====================================================
-- Migration: Countries Table (Supported Countries Only)
-- =====================================================
-- EasyMO supports exactly 4 countries: RW, CD, BI, TZ
-- Each country has ONE mobile money provider

BEGIN;

-- Step 1: Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 (RW, CD, BI, TZ)
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL, -- RWF, CDF, BIF, TZS
  currency_symbol TEXT,
  phone_prefix TEXT NOT NULL, -- +250, +243, +257, +255
  
  -- Mobile Money Service Details (ONE provider per country)
  mobile_money_provider TEXT NOT NULL, -- MTN MoMo, Orange Money, etc.
  mobile_money_brand TEXT NOT NULL, -- Display name: "MoMo", "Orange Money", etc.
  ussd_send_to_phone TEXT NOT NULL, -- USSD code pattern for P2P transfer
  ussd_pay_merchant TEXT NOT NULL, -- USSD code pattern for merchant payment
  
  -- Additional metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  flag_emoji TEXT, -- 🇷🇼, 🇨🇩, etc.
  timezone TEXT, -- Africa/Kigali, etc.
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);
CREATE INDEX IF NOT EXISTS idx_countries_phone_prefix ON countries(phone_prefix);
CREATE INDEX IF NOT EXISTS idx_countries_active ON countries(is_active);

-- Step 3: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_countries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS countries_updated_at ON countries;
CREATE TRIGGER countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_countries_updated_at();

-- Step 4: Insert ONLY supported countries (RW, CD, BI, TZ)
INSERT INTO countries (code, name, currency_code, currency_symbol, phone_prefix, mobile_money_provider, mobile_money_brand, ussd_send_to_phone, ussd_pay_merchant, flag_emoji, timezone, sort_order, is_active) VALUES
  ('RW', 'Rwanda', 'RWF', 'FRw', '+250', 'MTN Mobile Money', 'MoMo', '*182*1*1*{phone}*{amount}#', '*182*8*1*{code}*{amount}#', '🇷🇼', 'Africa/Kigali', 1, true),
  ('CD', 'DR Congo', 'CDF', 'FC', '+243', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇨🇩', 'Africa/Kinshasa', 2, true),
  ('BI', 'Burundi', 'BIF', 'FBu', '+257', 'Econet EcoCash', 'EcoCash', '*151*1*1*{phone}*{amount}#', '*151*1*2*{phone}*{amount}#', '🇧🇮', 'Africa/Bujumbura', 3, true),
  ('TZ', 'Tanzania', 'TZS', 'TSh', '+255', 'Vodacom M-Pesa', 'M-Pesa', '*150*00*{phone}*{amount}#', '*150*00*{code}*{amount}#', '🇹🇿', 'Africa/Dar_es_Salaam', 4, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  phone_prefix = EXCLUDED.phone_prefix,
  mobile_money_provider = EXCLUDED.mobile_money_provider,
  mobile_money_brand = EXCLUDED.mobile_money_brand,
  ussd_send_to_phone = EXCLUDED.ussd_send_to_phone,
  ussd_pay_merchant = EXCLUDED.ussd_pay_merchant,
  flag_emoji = EXCLUDED.flag_emoji,
  timezone = EXCLUDED.timezone,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Step 5: Add mobile money columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_country_code TEXT DEFAULT 'RW';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_country_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_phone_number TEXT;

-- Step 6: Enable RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
DROP POLICY IF EXISTS "countries_read_all" ON countries;
CREATE POLICY "countries_read_all" ON countries
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Allow service role full access
DROP POLICY IF EXISTS "countries_service_role" ON countries;
CREATE POLICY "countries_service_role" ON countries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Create helper function to get provider by country
CREATE OR REPLACE FUNCTION get_momo_provider(country_code TEXT)
RETURNS TABLE(provider TEXT, brand TEXT, currency TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.mobile_money_provider,
    c.mobile_money_brand,
    c.currency_code
  FROM countries c
  WHERE c.code = country_code AND c.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 8: Create function to validate phone number prefix
CREATE OR REPLACE FUNCTION validate_phone_country(phone TEXT, expected_country TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  country_prefix TEXT;
BEGIN
  SELECT phone_prefix INTO country_prefix
  FROM countries
  WHERE code = expected_country AND is_active = true;
  
  IF country_prefix IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN phone LIKE country_prefix || '%';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE countries IS 'Supported countries with mobile money provider details. EasyMO supports: RW, CD, BI, TZ only.';

COMMIT;
