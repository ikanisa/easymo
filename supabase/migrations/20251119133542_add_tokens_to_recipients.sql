BEGIN;

-- Create wallet_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  tokens numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

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
