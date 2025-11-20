BEGIN;

-- Add 5000 tokens to specified phone numbers
-- First ensure wallet_accounts exist for these profiles
INSERT INTO public.wallet_accounts (profile_id, tokens)
SELECT 
  p.user_id,
  5000
FROM public.profiles p
WHERE p.whatsapp_e164 IN ('+250788767816', '+35677186193')
ON CONFLICT (profile_id) 
DO UPDATE SET 
  tokens = public.wallet_accounts.tokens + 5000,
  updated_at = timezone('utc', now());

COMMIT;
