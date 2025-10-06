-- Add vehicle plate storage for mobility compliance (RURA requirement)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_plate text;
