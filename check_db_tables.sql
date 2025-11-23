-- Check insurance tables
SELECT 'insurance_leads' as table_name, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'insurance_leads'
) as exists;

SELECT 'insurance_media' as table_name, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'insurance_media'
) as exists;

-- Check referral tables
SELECT 'referral_links' as table_name, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'referral_links'
) as exists;

-- Check wallet RPC
SELECT 'wallet_get_balance' as function_name, EXISTS (
  SELECT FROM pg_proc WHERE proname = 'wallet_get_balance'
) as exists;

SELECT 'wallet_transfer_tokens' as function_name, EXISTS (
  SELECT FROM pg_proc WHERE proname = 'wallet_transfer_tokens'
) as exists;

-- Check profiles columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('last_location', 'last_location_at')
ORDER BY column_name;

-- Check countries table
SELECT 'countries' as table_name, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'countries'
) as exists;
