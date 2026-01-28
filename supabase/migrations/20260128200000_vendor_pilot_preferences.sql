-- Migration: Vendor Pilot Preferences
-- Purpose: Add vendor preference columns for pilot operations
-- Date: 2026-01-28

BEGIN;

-- ============================================================
-- Add vendor preference columns
-- ============================================================

-- is_opted_out: Vendors who have opted out of all messages
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_opted_out BOOLEAN DEFAULT false;

-- preferred_language: Vendor's preferred communication language
-- Values: 'en' (English), 'fr' (French), 'rw' (Kinyarwanda)
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- preferred_categories: Limit inquiries to specific product categories
-- Empty array means all categories
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS preferred_categories TEXT[] DEFAULT '{}';

-- ============================================================
-- Indexes for efficient filtering
-- ============================================================

-- Index for quickly filtering out opted-out vendors
CREATE INDEX IF NOT EXISTS idx_vendors_opted_out 
  ON public.vendors(is_opted_out) 
  WHERE is_opted_out = true;

-- Index for language-based filtering
CREATE INDEX IF NOT EXISTS idx_vendors_preferred_language 
  ON public.vendors(preferred_language);

-- GIN index for category filtering
CREATE INDEX IF NOT EXISTS idx_vendors_preferred_categories 
  ON public.vendors USING gin(preferred_categories);

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON COLUMN public.vendors.is_opted_out IS 
  'If true, vendor has opted out and should NEVER be contacted';

COMMENT ON COLUMN public.vendors.preferred_language IS 
  'Vendor preferred language for outreach messages (en/fr/rw)';

COMMENT ON COLUMN public.vendors.preferred_categories IS 
  'Product categories vendor wants to receive inquiries for (empty = all)';

COMMIT;
