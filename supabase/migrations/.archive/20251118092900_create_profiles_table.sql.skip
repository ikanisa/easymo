
BEGIN;

DROP TABLE IF EXISTS public.wallet_accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  whatsapp_e164 TEXT,
  wa_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id),
  tokens INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE TABLE public.wallet_redeem_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_tokens INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id),
  code TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joiner_user_id UUID REFERENCES public.profiles(user_id),
  promoter_user_id UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.promo_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tokens_per_new_user INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;
