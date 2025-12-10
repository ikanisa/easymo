BEGIN;

-- Migration: Unify All Admin/Support Contacts
-- Purpose: Make insurance_admin_contacts the single source of truth for ALL admin/support contact info
-- Date: 2025-12-10

-- Add category column to support different use cases
ALTER TABLE public.insurance_admin_contacts 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'support' 
CHECK (category IN ('support', 'admin_auth', 'insurance', 'general', 'escalation'));

-- Add priority column for sorting
ALTER TABLE public.insurance_admin_contacts 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;

-- Create index on category
CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_category 
ON public.insurance_admin_contacts(category, is_active) 
WHERE is_active = true;

-- Update existing records to have proper categories
UPDATE public.insurance_admin_contacts
SET category = 'insurance'
WHERE category IS NULL OR category = 'support';

-- Insert admin authentication numbers (migrating from hardcoded DEFAULT_ADMIN_NUMBERS)
INSERT INTO public.insurance_admin_contacts (
  channel, 
  destination, 
  display_name, 
  category, 
  display_order, 
  priority,
  is_active
) VALUES
  ('whatsapp', '+250788767816', 'Admin Team 1', 'admin_auth', 1, 10, true),
  ('whatsapp', '+35677186193', 'Admin Team 2', 'admin_auth', 2, 10, true),
  ('whatsapp', '+250795588248', 'Admin Team 3', 'admin_auth', 3, 10, true),
  ('whatsapp', '+35699742524', 'Admin Team 4', 'admin_auth', 4, 10, true)
ON CONFLICT (destination) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  priority = EXCLUDED.priority,
  is_active = EXCLUDED.is_active;

-- Add unique constraint on destination to prevent duplicates
ALTER TABLE public.insurance_admin_contacts 
ADD CONSTRAINT IF NOT EXISTS insurance_admin_contacts_destination_unique 
UNIQUE (destination);

-- Create helper function to get contacts by category
CREATE OR REPLACE FUNCTION public.get_admin_contacts(
  p_category TEXT DEFAULT 'support',
  p_channel TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  channel TEXT,
  destination TEXT,
  display_name TEXT,
  category TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.channel,
    c.destination,
    c.display_name,
    c.category,
    c.display_order
  FROM insurance_admin_contacts c
  WHERE c.is_active = true
    AND (p_category IS NULL OR c.category = p_category)
    AND (p_channel IS NULL OR c.channel = p_channel)
  ORDER BY c.priority ASC, c.display_order ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO service_role;

-- Comments
COMMENT ON COLUMN public.insurance_admin_contacts.category IS 'Category: support (general help), admin_auth (admin verification), insurance (insurance-specific), general (catch-all), escalation (urgent issues)';
COMMENT ON COLUMN public.insurance_admin_contacts.priority IS 'Lower number = higher priority. Used for sorting within category.';
COMMENT ON FUNCTION public.get_admin_contacts IS 'Fetches admin/support contacts filtered by category and optionally by channel';

COMMIT;
