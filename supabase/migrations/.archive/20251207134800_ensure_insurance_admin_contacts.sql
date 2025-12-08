-- Ensure Insurance Admin Contacts Configuration
-- This migration ensures the insurance admin notification system is properly configured
BEGIN;

-- Ensure insurance_admin_contacts table exists (should already exist from 20251204130000_insurance_core_schema.sql)
-- This is a safety check in case the table doesn't exist
CREATE TABLE IF NOT EXISTS public.insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('whatsapp', 'email', 'phone')),
  contact_value TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_active 
  ON public.insurance_admin_contacts(is_active) 
  WHERE is_active = TRUE;

-- Ensure RLS is enabled
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;

-- Grant permissions to service role
GRANT ALL ON public.insurance_admin_contacts TO service_role;

-- Seed default admin contacts if table is empty
-- Only inserts if no active WhatsApp contacts exist
DO $$
DECLARE
  contact_count INTEGER;
  seeded BOOLEAN := FALSE;
BEGIN
  -- Count existing active WhatsApp contacts
  SELECT COUNT(*) INTO contact_count 
  FROM public.insurance_admin_contacts 
  WHERE is_active = TRUE 
    AND contact_type = 'whatsapp';
  
  -- If no active WhatsApp contacts, seed defaults
  -- NOTE: Replace these placeholder numbers with your actual admin contacts
  IF contact_count = 0 THEN
    -- Insert default admin contacts
    -- IMPORTANT: Update these contact values with your actual admin WhatsApp numbers
    INSERT INTO public.insurance_admin_contacts (contact_type, contact_value, display_name, display_order, is_active) 
    VALUES
      ('whatsapp', '+250795588248', 'Insurance Support Team 1', 1, true),
      ('whatsapp', '+250793094876', 'Insurance Support Team 2', 2, true),
      ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true),
      ('email', 'insurance@easymo.rw', 'Insurance Email', 10, true)
    ON CONFLICT DO NOTHING;
    
    seeded := TRUE;
    
    RAISE NOTICE 'Insurance admin contacts seeded: Added default admin contacts';
  ELSE
    RAISE NOTICE 'Insurance admin contacts already configured: Found % active WhatsApp contacts', contact_count;
  END IF;
  
  -- Log the seeding action for monitoring
  IF seeded THEN
    RAISE WARNING 'IMPORTANT: Default insurance admin contacts were seeded from migration. Please verify these contacts are correct and update if needed in the insurance_admin_contacts table.';
  END IF;
END;
$$;

COMMIT;
