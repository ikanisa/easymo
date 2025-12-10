-- Add phone_number and google_maps_url columns to businesses table
-- Additive-only migration to support pharmacy data with contact and map information

BEGIN;

-- Add phone_number column for business contact information
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Add google_maps_url column for Google Maps links
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_maps_url text;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_businesses_phone_number
  ON public.businesses(phone_number)
  WHERE phone_number IS NOT NULL;

-- Create index for category filtering (if not exists from previous migrations)
CREATE INDEX IF NOT EXISTS idx_businesses_category
  ON public.businesses(category)
  WHERE category IS NOT NULL;

COMMIT;
