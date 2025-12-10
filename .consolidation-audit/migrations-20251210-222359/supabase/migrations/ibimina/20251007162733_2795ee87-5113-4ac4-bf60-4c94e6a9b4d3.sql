-- Drop duplicate encryption columns if they exist
ALTER TABLE public.ikimina_members
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash,
  DROP COLUMN IF EXISTS national_id_encrypted,
  DROP COLUMN IF EXISTS national_id_masked,
  DROP COLUMN IF EXISTS national_id_hash;
ALTER TABLE public.sms_inbox
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash;
ALTER TABLE public.payments
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash;
-- Add encryption columns cleanly (one time only)
ALTER TABLE public.ikimina_members
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT,
  ADD COLUMN national_id_encrypted TEXT,
  ADD COLUMN national_id_masked TEXT,
  ADD COLUMN national_id_hash TEXT;
ALTER TABLE public.sms_inbox
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT;
ALTER TABLE public.payments
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT;
-- Recreate indexes for encrypted lookup patterns
DROP INDEX IF EXISTS idx_ikimina_members_msisdn_hash;
DROP INDEX IF EXISTS idx_ikimina_members_national_id_hash;
DROP INDEX IF EXISTS idx_payments_msisdn_hash;
DROP INDEX IF EXISTS idx_sms_inbox_msisdn_hash;
CREATE INDEX idx_ikimina_members_msisdn_hash ON public.ikimina_members(msisdn_hash);
CREATE INDEX idx_ikimina_members_national_id_hash ON public.ikimina_members(national_id_hash);
CREATE INDEX idx_payments_msisdn_hash ON public.payments(msisdn_hash);
CREATE INDEX idx_sms_inbox_msisdn_hash ON public.sms_inbox(msisdn_hash);
-- Seed masked values for existing rows
UPDATE public.ikimina_members
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.payments
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.sms_inbox
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
