BEGIN;

-- =====================================================
-- RESTORE BARS AND BAR_NUMBERS TABLES - November 21, 2025
-- =====================================================
-- Restores bars and bar_numbers tables needed by wa-webhook vendor functionality
-- Error: "Could not find the table 'public.bar_numbers' in the schema cache"
-- =====================================================

-- Create bar_contact_role enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bar_contact_role') THEN
    CREATE TYPE public.bar_contact_role AS ENUM ('manager', 'staff');
  END IF;
END $$;

-- Create bars table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location_text TEXT,
  country TEXT,
  city_area TEXT,
  currency TEXT,
  momo_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure columns exist if table already existed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'slug') THEN
    ALTER TABLE public.bars ADD COLUMN slug TEXT;
    -- Add unique constraint if slug is added (might need to handle existing data first, but assuming empty or nullable for now)
    -- If there is existing data, slug might need to be populated.
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'name') THEN
    ALTER TABLE public.bars ADD COLUMN name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'location_text') THEN
    ALTER TABLE public.bars ADD COLUMN location_text TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'country') THEN
    ALTER TABLE public.bars ADD COLUMN country TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'city_area') THEN
    ALTER TABLE public.bars ADD COLUMN city_area TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'currency') THEN
    ALTER TABLE public.bars ADD COLUMN currency TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'momo_code') THEN
    ALTER TABLE public.bars ADD COLUMN momo_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'is_active') THEN
    ALTER TABLE public.bars ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create bar_numbers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bar_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  number_e164 TEXT NOT NULL,
  number_digits TEXT, -- For faster lookups by digit-only matching
  role public.bar_contact_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  verified_at TIMESTAMPTZ,
  added_by TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT bar_numbers_unique_number_per_bar UNIQUE (bar_id, number_e164)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_bar_numbers_bar_id ON public.bar_numbers(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_numbers_number_e164 ON public.bar_numbers(number_e164) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bar_numbers_number_digits ON public.bar_numbers(number_digits) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bar_numbers_is_active ON public.bar_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);

-- Enable RLS on both tables
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for bars
DO $$
BEGIN
  -- Service role has full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'bars' 
    AND policyname = 'bars_service_all'
  ) THEN
    CREATE POLICY "bars_service_all" ON public.bars
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Authenticated users can read active bars
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'bars' 
    AND policyname = 'bars_read_active'
  ) THEN
    CREATE POLICY "bars_read_active" ON public.bars
      FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- RLS policies for bar_numbers
DO $$
BEGIN
  -- Service role has full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'bar_numbers' 
    AND policyname = 'bar_numbers_service_all'
  ) THEN
    CREATE POLICY "bar_numbers_service_all" ON public.bar_numbers
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Authenticated users can read active bar numbers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'bar_numbers' 
    AND policyname = 'bar_numbers_read_active'
  ) THEN
    CREATE POLICY "bar_numbers_read_active" ON public.bar_numbers
      FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Function to extract digits from phone number for number_digits column
CREATE OR REPLACE FUNCTION public.extract_digits(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(phone_number, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-populate number_digits
CREATE OR REPLACE FUNCTION public.bar_numbers_set_number_digits()
RETURNS TRIGGER AS $$
BEGIN
  NEW.number_digits = public.extract_digits(NEW.number_e164);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bar_numbers_set_number_digits
  BEFORE INSERT OR UPDATE OF number_e164 ON public.bar_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.bar_numbers_set_number_digits();

-- Update trigger for bars updated_at
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- Update trigger for bar_numbers updated_at
CREATE OR REPLACE FUNCTION public.update_bar_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bar_numbers_updated_at
  BEFORE UPDATE ON public.bar_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bar_numbers_updated_at();

-- Populate number_digits for any existing records
UPDATE public.bar_numbers SET number_digits = public.extract_digits(number_e164) WHERE number_digits IS NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
