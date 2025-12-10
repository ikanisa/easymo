BEGIN;

-- Migration: Add support for multiple WhatsApp numbers per business
-- Date: 2025-11-12
-- Description: Creates a junction table to allow businesses to have multiple WhatsApp contact numbers

-- Create business_whatsapp_numbers table
CREATE TABLE IF NOT EXISTS public.business_whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  added_by_whatsapp TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT business_whatsapp_unique UNIQUE (business_id, whatsapp_e164),
  CONSTRAINT valid_whatsapp_format CHECK (whatsapp_e164 ~ '^\+[1-9]\d{1,14}$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_whatsapp_numbers_business_id 
  ON public.business_whatsapp_numbers(business_id);
CREATE INDEX IF NOT EXISTS idx_business_whatsapp_numbers_whatsapp 
  ON public.business_whatsapp_numbers(whatsapp_e164);

-- Add RLS policies
ALTER TABLE public.business_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view numbers for businesses they own
CREATE POLICY "Users can view numbers for their businesses"
  ON public.business_whatsapp_numbers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can insert numbers for businesses they own
CREATE POLICY "Users can add numbers to their businesses"
  ON public.business_whatsapp_numbers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can update numbers for businesses they own
CREATE POLICY "Users can update numbers for their businesses"
  ON public.business_whatsapp_numbers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can delete numbers for businesses they own
CREATE POLICY "Users can delete numbers from their businesses"
  ON public.business_whatsapp_numbers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_business_whatsapp_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_business_whatsapp_numbers_updated_at
  BEFORE UPDATE ON public.business_whatsapp_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_whatsapp_numbers_updated_at();

-- Migrate existing owner_whatsapp to the new table as primary number
INSERT INTO public.business_whatsapp_numbers (business_id, whatsapp_e164, is_primary, verified)
SELECT id, owner_whatsapp, TRUE, TRUE
FROM public.businesses
WHERE owner_whatsapp IS NOT NULL
ON CONFLICT (business_id, whatsapp_e164) DO NOTHING;

COMMIT;
