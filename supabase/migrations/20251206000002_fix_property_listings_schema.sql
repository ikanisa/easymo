-- Fix property_listings table schema - add missing columns

BEGIN;

-- Add all missing columns to existing property_listings table
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'rent' CHECK (listing_type IN ('rent', 'sale'));
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ', 'MT'));
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS bathrooms INTEGER;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RWF' CHECK (currency IN ('RWF', 'USD', 'EUR'));
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS size_sqm NUMERIC(10,2);
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS furnished BOOLEAN DEFAULT false;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS parking BOOLEAN DEFAULT false;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rented', 'sold', 'inactive'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_listings_profile ON public.property_listings(profile_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_city ON public.property_listings(city);
CREATE INDEX IF NOT EXISTS idx_property_listings_type ON public.property_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON public.property_listings(status);

COMMIT;
