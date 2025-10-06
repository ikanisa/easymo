-- Add vehicle plate storage for mobility compliance (RURA requirement)
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_plate text;

COMMIT;
