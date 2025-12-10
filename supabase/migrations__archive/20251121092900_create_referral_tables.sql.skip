BEGIN;

-- Create referral_links table for tracking user referral codes
-- Create referral_links table for tracking user referral codes
CREATE TABLE IF NOT EXISTS public.referral_links (
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  code text NOT NULL,
  short_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, code)
);

-- Evolve referral_links if it exists from previous migration
DO $$ 
BEGIN
  -- Add short_url if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_links' AND column_name = 'short_url') THEN
    ALTER TABLE public.referral_links ADD COLUMN short_url text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS referral_links_code_key ON public.referral_links(code);

-- Create referral_clicks table for tracking clicks on referral links
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  clicked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ip text,
  user_agent text,
  country_guess text
);

-- Create referral_attributions table for tracking successful referrals
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  sharer_user_id uuid REFERENCES public.profiles(user_id),
  joiner_user_id uuid REFERENCES public.profiles(user_id),
  first_message_at timestamptz,
  credited boolean NOT NULL DEFAULT false,
  credited_tokens int NOT NULL DEFAULT 0,
  reason text
);

-- Evolve referral_attributions if it exists from previous migration
DO $$ 
BEGIN
  -- Rename promoter_user_id to sharer_user_id if it exists and sharer_user_id does not
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'promoter_user_id') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'sharer_user_id') THEN
    ALTER TABLE public.referral_attributions RENAME COLUMN promoter_user_id TO sharer_user_id;
  END IF;

  -- Add missing columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'code') THEN
    ALTER TABLE public.referral_attributions ADD COLUMN code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'first_message_at') THEN
    ALTER TABLE public.referral_attributions ADD COLUMN first_message_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'credited') THEN
    ALTER TABLE public.referral_attributions ADD COLUMN credited boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'credited_tokens') THEN
    ALTER TABLE public.referral_attributions ADD COLUMN credited_tokens int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_attributions' AND column_name = 'reason') THEN
    ALTER TABLE public.referral_attributions ADD COLUMN reason text;
  END IF;
END $$;

-- Enable RLS on referral tables
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_links
-- Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='referral_links_service'
  ) THEN
    CREATE POLICY "referral_links_service" ON public.referral_links
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Users can read their own referral links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_links' AND policyname='referral_links_self_select'
  ) THEN
    CREATE POLICY "referral_links_self_select" ON public.referral_links
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;
END $$;

-- RLS policies for referral_clicks
-- Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_clicks' AND policyname='referral_clicks_service'
  ) THEN
    CREATE POLICY "referral_clicks_service" ON public.referral_clicks
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RLS policies for referral_attributions
-- Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_attributions' AND policyname='referral_attributions_service'
  ) THEN
    CREATE POLICY "referral_attributions_service" ON public.referral_attributions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Users can read attributions where they are the sharer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_attributions' AND policyname='referral_attributions_sharer_select'
  ) THEN
    CREATE POLICY "referral_attributions_sharer_select" ON public.referral_attributions
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL AND auth.uid() = sharer_user_id);
  END IF;
END $$;

COMMIT;
