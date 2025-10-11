-- Phase 1: align contacts with profiles and normalize contribution amounts
BEGIN;

-- Ensure contacts table supports update trigger expectations
ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS profile_id uuid;

UPDATE public.contacts AS c
SET profile_id = p.user_id
FROM public.profiles AS p
WHERE c.profile_id IS NULL
  AND c.msisdn_e164 = p.whatsapp_e164;

ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_profile_id_fkey FOREIGN KEY (profile_id)
        REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_profile_unique
    ON public.contacts(profile_id)
    WHERE profile_id IS NOT NULL;

COMMENT ON COLUMN public.contacts.profile_id IS 'Optional reference to profiles.user_id for opt-in contacts (Phase 1).';

-- 2. Basket contributions: converge on minor-unit integer amounts
ALTER TABLE public.basket_contributions
    DROP COLUMN IF EXISTS amount_rwf;

ALTER TABLE public.basket_contributions
    ALTER COLUMN amount_minor SET DATA TYPE bigint USING amount_minor::bigint,
    ALTER COLUMN amount_minor SET NOT NULL,
    ALTER COLUMN currency SET DEFAULT 'RWF';

COMMIT;
