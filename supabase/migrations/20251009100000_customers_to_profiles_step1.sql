-- Phase 1 Step 1: add profile references alongside legacy customer_id
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'carts' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.carts
      ADD COLUMN profile_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN profile_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.sessions
      ADD COLUMN profile_id uuid;
  END IF;
END $$;

-- Create mapping table only if missing
CREATE TABLE IF NOT EXISTS public.legacy_customer_profile (
  customer_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(user_id)
);

-- Populate mapping by existing whatsapp number
INSERT INTO public.legacy_customer_profile (customer_id, profile_id)
SELECT c.id, p.user_id
FROM public.customers c
JOIN public.profiles p ON p.whatsapp_e164 = c.wa_id
ON CONFLICT (customer_id) DO NOTHING;

-- Create missing profiles for legacy customers without match
WITH missing AS (
  SELECT c.*
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.whatsapp_e164 = c.wa_id
  WHERE p.user_id IS NULL
), inserted AS (
  INSERT INTO public.profiles (whatsapp_e164, display_name)
  SELECT wa_id, display_name FROM missing
  RETURNING user_id, whatsapp_e164
)
INSERT INTO public.legacy_customer_profile (customer_id, profile_id)
SELECT c.id, i.user_id
FROM public.customers c
JOIN inserted i ON i.whatsapp_e164 = c.wa_id
ON CONFLICT (customer_id) DO NOTHING;

-- Backfill new columns
UPDATE public.carts cart
SET profile_id = map.profile_id
FROM public.legacy_customer_profile map
WHERE cart.customer_id = map.customer_id AND cart.profile_id IS NULL;

UPDATE public.orders ord
SET profile_id = map.profile_id
FROM public.legacy_customer_profile map
WHERE ord.customer_id = map.customer_id AND ord.profile_id IS NULL;

UPDATE public.sessions sess
SET profile_id = map.profile_id
FROM public.legacy_customer_profile map
WHERE sess.customer_id = map.customer_id AND sess.profile_id IS NULL;

-- Add helpful indexes to support lookup
CREATE INDEX IF NOT EXISTS idx_carts_profile ON public.carts(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_profile ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON public.sessions(profile_id);
COMMIT;
