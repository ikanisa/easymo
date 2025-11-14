BEGIN;

-- =====================================================
-- Migration: Countries Table with Mobile Money Services
-- =====================================================
-- Creates a comprehensive countries table with mobile money details
-- and links to WhatsApp home menu items for country-specific naming

-- Step 1: Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 (RW, UG, KE, etc.)
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL, -- RWF, UGX, KES, etc.
  currency_symbol TEXT,
  phone_prefix TEXT NOT NULL, -- +250, +256, etc.
  
  -- Mobile Money Service Details
  mobile_money_provider TEXT NOT NULL, -- MTN MoMo, Orange Money, etc.
  mobile_money_brand TEXT NOT NULL, -- Display name: "MoMo", "Orange Money", etc.
  ussd_send_to_phone TEXT NOT NULL, -- USSD code pattern for P2P transfer
  ussd_pay_merchant TEXT NOT NULL, -- USSD code pattern for merchant payment
  
  -- Additional metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  flag_emoji TEXT, -- 🇷🇼, 🇺🇬, etc.
  timezone TEXT, -- Africa/Kigali, Africa/Kampala, etc.
  
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

CREATE TRIGGER countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_countries_updated_at();

-- Step 4: Insert countries with mobile money data
INSERT INTO countries (code, name, currency_code, currency_symbol, phone_prefix, mobile_money_provider, mobile_money_brand, ussd_send_to_phone, ussd_pay_merchant, flag_emoji, timezone, sort_order) VALUES
  -- East Africa
  ('RW', 'Rwanda', 'RWF', 'FRw', '+250', 'MTN Mobile Money', 'MoMo', '*182*1*1*{phone}*{amount}#', '*182*8*1*{code}*{amount}#', '🇷🇼', 'Africa/Kigali', 1),
  ('UG', 'Uganda', 'UGX', 'USh', '+256', 'MTN Mobile Money', 'MoMo', '*165*{phone}*{amount}#', '*165*3*{code}*{amount}#', '🇺🇬', 'Africa/Kampala', 2),
  ('KE', 'Kenya', 'KES', 'KSh', '+254', 'M-Pesa (Safaricom)', 'M-Pesa', '*126*{phone}*{amount}#', '*126*4*{code}*{amount}#', '🇰🇪', 'Africa/Nairobi', 3),
  ('TZ', 'Tanzania', 'TZS', 'TSh', '+255', 'Vodacom M-Pesa', 'M-Pesa', '*150*00*{phone}*{amount}#', '*150*00*{code}*{amount}#', '🇹🇿', 'Africa/Dar_es_Salaam', 4),
  ('BI', 'Burundi', 'BIF', 'FBu', '+257', 'Econet EcoCash', 'EcoCash', '*151*1*1*{phone}*{amount}#', '*151*1*2*{phone}*{amount}#', '🇧🇮', 'Africa/Bujumbura', 5),
  
  -- Central Africa
  ('CM', 'Cameroon', 'XAF', 'FCFA', '+237', 'MTN Mobile Money', 'MoMo', '*126*2*{phone}*{amount}#', '*126*4*{code}*{amount}#', '🇨🇲', 'Africa/Douala', 10),
  ('CD', 'DR Congo', 'CDF', 'FC', '+243', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇨🇩', 'Africa/Kinshasa', 11),
  ('CG', 'Congo (Republic)', 'XAF', 'FCFA', '+242', 'MTN Mobile Money', 'MoMo', '*133*2*{phone}*{amount}#', '*133*5*{code}*{amount}#', '🇨🇬', 'Africa/Brazzaville', 12),
  ('GA', 'Gabon', 'XAF', 'FCFA', '+241', 'Airtel Money', 'Airtel Money', '*150*2*{phone}*{amount}#', '*150*4*{code}*{amount}#', '🇬🇦', 'Africa/Libreville', 13),
  ('CF', 'Central African Republic', 'XAF', 'FCFA', '+236', 'Orange Money', 'Orange Money', '#150*2*{phone}*{amount}#', '#150*4*{code}*{amount}#', '🇨🇫', 'Africa/Bangui', 14),
  ('TD', 'Chad', 'XAF', 'FCFA', '+235', 'Airtel Money', 'Airtel Money', '*211*{phone}*{amount}#', '*211*{code}*{amount}#', '🇹🇩', 'Africa/Ndjamena', 15),
  ('GQ', 'Equatorial Guinea', 'XAF', 'FCFA', '+240', 'GETESA Mobile Money', 'GETESA', '*222*2*{phone}*{amount}#', '*222*4*{code}*{amount}#', '🇬🇶', 'Africa/Malabo', 16),
  
  -- West Africa
  ('GH', 'Ghana', 'GHS', 'GH₵', '+233', 'MTN Mobile Money', 'MoMo', '*170*1*1*{phone}*{amount}#', '*170*2*1*{code}*{amount}#', '🇬🇭', 'Africa/Accra', 20),
  ('CI', 'Côte d''Ivoire', 'XOF', 'FCFA', '+225', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇨🇮', 'Africa/Abidjan', 21),
  ('BJ', 'Benin', 'XOF', 'FCFA', '+229', 'MTN Mobile Money', 'MoMo', '*880*1*{phone}*{amount}#', '*880*3*{code}*{amount}#', '🇧🇯', 'Africa/Porto-Novo', 22),
  ('BF', 'Burkina Faso', 'XOF', 'FCFA', '+226', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇧🇫', 'Africa/Ouagadougou', 23),
  ('SN', 'Senegal', 'XOF', 'FCFA', '+221', 'Orange Money', 'Orange Money', '#144*1*{phone}*{amount}#', '#144*2*{code}*{amount}#', '🇸🇳', 'Africa/Dakar', 24),
  ('TG', 'Togo', 'XOF', 'FCFA', '+228', 'Togocom T-Money', 'T-Money', '*145*1*{amount}*{phone}#', '*145*2*{code}*{amount}#', '🇹🇬', 'Africa/Lome', 25),
  ('ML', 'Mali', 'XOF', 'FCFA', '+223', 'Orange Money', 'Orange Money', '#144#*1*{phone}*{amount}#', '#144#*2*{code}*{amount}#', '🇲🇱', 'Africa/Bamako', 26),
  ('GN', 'Guinea', 'GNF', 'FG', '+224', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇬🇳', 'Africa/Conakry', 27),
  ('NE', 'Niger', 'XOF', 'FCFA', '+227', 'Airtel Money', 'Airtel Money', '*400*{phone}*{amount}#', '*400*{code}*{amount}#', '🇳🇪', 'Africa/Niamey', 28),
  ('MR', 'Mauritania', 'MRU', 'UM', '+222', 'Moov Mauritel Money', 'Moov Money', '*900*2*{phone}*{amount}#', '*900*4*{code}*{amount}#', '🇲🇷', 'Africa/Nouakchott', 29),
  
  -- Southern Africa
  ('ZM', 'Zambia', 'ZMW', 'ZK', '+260', 'MTN Mobile Money', 'MoMo', '*115*2*{phone}*{amount}#', '*115*5*{code}*{amount}#', '🇿🇲', 'Africa/Lusaka', 30),
  ('ZW', 'Zimbabwe', 'ZWL', 'Z$', '+263', 'Econet EcoCash', 'EcoCash', '*151*1*1*{phone}*{amount}#', '*151*2*{code}*{amount}#', '🇿🇼', 'Africa/Harare', 31),
  ('MW', 'Malawi', 'MWK', 'MK', '+265', 'Airtel Money', 'Airtel Money', '*211*{phone}*{amount}#', '*211*{code}*{amount}#', '🇲🇼', 'Africa/Blantyre', 32),
  ('NA', 'Namibia', 'NAD', 'N$', '+264', 'MTC Money (Maris)', 'MTC Money', '*140*682*{phone}*{amount}#', '*140*682*{code}*{amount}#', '🇳🇦', 'Africa/Windhoek', 33),
  
  -- Indian Ocean
  ('MG', 'Madagascar', 'MGA', 'Ar', '+261', 'Telma MVola', 'MVola', '#111*2*{phone}*{amount}#', '#111*4*{code}*{amount}#', '🇲🇬', 'Indian/Antananarivo', 40),
  ('MU', 'Mauritius', 'MUR', 'Rs', '+230', 'Mauritius Telecom my.t', 'my.t money', 'N/A (App-based)', 'N/A (App-based)', '🇲🇺', 'Indian/Mauritius', 41),
  ('SC', 'Seychelles', 'SCR', 'SR', '+248', 'Airtel Money', 'Airtel Money', '*202*{phone}*{amount}#', '*202*{code}*{amount}#', '🇸🇨', 'Indian/Mahe', 42),
  ('KM', 'Comoros', 'KMF', 'CF', '+269', 'Telma YAZ MVola', 'MVola', '*150*01*1*1*{phone}*{amount}#', '*150*01*1*2*{code}*{amount}#', '🇰🇲', 'Indian/Comoro', 43),
  
  -- Horn of Africa
  ('DJ', 'Djibouti', 'DJF', 'Fdj', '+253', 'Djibouti Telecom D-Money', 'D-Money', '*131*{phone}*{amount}#', '*133*{code}*{amount}#', '🇩🇯', 'Africa/Djibouti', 50)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  mobile_money_provider = EXCLUDED.mobile_money_provider,
  mobile_money_brand = EXCLUDED.mobile_money_brand,
  ussd_send_to_phone = EXCLUDED.ussd_send_to_phone,
  ussd_pay_merchant = EXCLUDED.ussd_pay_merchant,
  flag_emoji = EXCLUDED.flag_emoji;

-- Step 5: Add country-specific naming to whatsapp_home_menu_items
-- Add columns for country-specific overrides
ALTER TABLE whatsapp_home_menu_items 
ADD COLUMN IF NOT EXISTS country_specific_names JSONB DEFAULT '{}'::jsonb;

-- Step 6: Update MOMO QR menu item with country-specific names
UPDATE whatsapp_home_menu_items
SET country_specific_names = jsonb_build_object(
  'RW', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'UG', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'KE', jsonb_build_object('name', 'M-Pesa QR Code', 'description', 'Generate M-Pesa payment QR codes'),
  'TZ', jsonb_build_object('name', 'M-Pesa QR Code', 'description', 'Generate M-Pesa payment QR codes'),
  'BI', jsonb_build_object('name', 'EcoCash QR Code', 'description', 'Generate EcoCash payment QR codes'),
  'CM', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'CD', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'CG', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'GA', jsonb_build_object('name', 'Airtel Money QR', 'description', 'Generate Airtel Money payment QR codes'),
  'CF', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'TD', jsonb_build_object('name', 'Airtel Money QR', 'description', 'Generate Airtel Money payment QR codes'),
  'GQ', jsonb_build_object('name', 'GETESA QR Code', 'description', 'Generate GETESA payment QR codes'),
  'GH', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'CI', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'BJ', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'BF', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'SN', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'TG', jsonb_build_object('name', 'T-Money QR Code', 'description', 'Generate T-Money payment QR codes'),
  'ML', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'GN', jsonb_build_object('name', 'Orange Money QR', 'description', 'Generate Orange Money payment QR codes'),
  'NE', jsonb_build_object('name', 'Airtel Money QR', 'description', 'Generate Airtel Money payment QR codes'),
  'MR', jsonb_build_object('name', 'Moov Money QR', 'description', 'Generate Moov Money payment QR codes'),
  'ZM', jsonb_build_object('name', 'MOMO QR Code', 'description', 'Generate MTN MoMo payment QR codes'),
  'ZW', jsonb_build_object('name', 'EcoCash QR Code', 'description', 'Generate EcoCash payment QR codes'),
  'MW', jsonb_build_object('name', 'Airtel Money QR', 'description', 'Generate Airtel Money payment QR codes'),
  'NA', jsonb_build_object('name', 'MTC Money QR', 'description', 'Generate MTC Money payment QR codes'),
  'MG', jsonb_build_object('name', 'MVola QR Code', 'description', 'Generate MVola payment QR codes'),
  'MU', jsonb_build_object('name', 'my.t money QR', 'description', 'Generate my.t money payment QR codes'),
  'SC', jsonb_build_object('name', 'Airtel Money QR', 'description', 'Generate Airtel Money payment QR codes'),
  'KM', jsonb_build_object('name', 'MVola QR Code', 'description', 'Generate MVola payment QR codes'),
  'DJ', jsonb_build_object('name', 'D-Money QR Code', 'description', 'Generate D-Money payment QR codes')
)
WHERE key = 'momo_qr';

-- Step 7: Create view for country-specific menu items
CREATE OR REPLACE VIEW whatsapp_menu_by_country AS
SELECT 
  c.code as country_code,
  c.name as country_name,
  c.mobile_money_brand,
  wm.id as menu_item_id,
  wm.key as menu_key,
  wm.name as default_name,
  wm.icon,
  wm.display_order,
  wm.is_active,
  COALESCE(
    (wm.country_specific_names->c.code->>'name')::text,
    wm.name
  ) as localized_name,
  COALESCE(
    (wm.country_specific_names->c.code->>'description')::text,
    ''
  ) as localized_description
FROM countries c
CROSS JOIN whatsapp_home_menu_items wm
WHERE c.code = ANY(wm.active_countries)
  AND c.is_active = true
  AND wm.is_active = true
ORDER BY c.sort_order, wm.display_order;

-- Step 8: Add comments
COMMENT ON TABLE countries IS 'Countries with mobile money service details and phone prefixes';
COMMENT ON COLUMN countries.ussd_send_to_phone IS 'USSD code pattern for P2P transfer. Use {phone} and {amount} as placeholders';
COMMENT ON COLUMN countries.ussd_pay_merchant IS 'USSD code pattern for merchant payment. Use {code} and {amount} as placeholders';
COMMENT ON COLUMN whatsapp_home_menu_items.country_specific_names IS 'Country-specific menu item names and descriptions. Format: {"RW": {"name": "...", "description": "..."}}';
COMMENT ON VIEW whatsapp_menu_by_country IS 'WhatsApp menu items with country-specific names (e.g., "MOMO QR" in RW, "Orange Money QR" in CI)';

COMMIT;
