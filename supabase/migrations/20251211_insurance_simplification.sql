-- Insurance Domain Simplification Migration
-- Remove OCR complexity, add simple request tracking

BEGIN;

-- ============================================================================
-- PART 1: CREATE SIMPLIFIED REQUEST TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insurance_requests_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wa_id TEXT NOT NULL,
  user_name TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'carte_jaune', 'chat_request')),
  media_id TEXT,
  status TEXT DEFAULT 'forwarded' CHECK (status IN ('forwarded', 'contacted', 'completed', 'cancelled')),
  admins_notified INTEGER DEFAULT 0,
  admin_notes TEXT,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_requests_simple_user 
  ON public.insurance_requests_simple(user_wa_id);

CREATE INDEX IF NOT EXISTS idx_insurance_requests_simple_status 
  ON public.insurance_requests_simple(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_requests_simple_type 
  ON public.insurance_requests_simple(document_type);

-- RLS
ALTER TABLE public.insurance_requests_simple ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.insurance_requests_simple;
CREATE POLICY "Service role full access" ON public.insurance_requests_simple
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 2: CREATE insurance_admin_contacts IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('whatsapp', 'email', 'phone')),
  contact_value TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'insurance',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_type, contact_value)
);

CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_active 
  ON public.insurance_admin_contacts(category, is_active, display_order);

ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.insurance_admin_contacts;
CREATE POLICY "Service role full access" ON public.insurance_admin_contacts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: ADD SAMPLE ADMIN CONTACTS (if table is empty)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts LIMIT 1) THEN
    INSERT INTO public.insurance_admin_contacts (contact_type, contact_value, display_name, category, display_order)
    VALUES
      ('whatsapp', '+250788000000', 'Insurance Admin 1', 'insurance', 1),
      ('whatsapp', '+250788000001', 'Insurance Admin 2', 'insurance', 2)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Added sample insurance admin contacts. UPDATE with real numbers!';
  END IF;
END $$;

-- ============================================================================
-- PART 4: ARCHIVE OLD OCR-RELATED TABLES (Don't drop yet - just rename)
-- ============================================================================

DO $$
BEGIN
  -- Archive insurance_media_queue
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_media_queue') THEN
    ALTER TABLE insurance_media_queue RENAME TO insurance_media_queue_archived;
    RAISE NOTICE 'Archived insurance_media_queue → insurance_media_queue_archived';
  END IF;

  -- Archive insurance_ocr_results if exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_ocr_results') THEN
    ALTER TABLE insurance_ocr_results RENAME TO insurance_ocr_results_archived;
    RAISE NOTICE 'Archived insurance_ocr_results → insurance_ocr_results_archived';
  END IF;
  
  -- Archive insurance_leads (OCR-based)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_leads') THEN
    ALTER TABLE insurance_leads RENAME TO insurance_leads_archived;
    RAISE NOTICE 'Archived insurance_leads → insurance_leads_archived';
  END IF;
END $$;

-- ============================================================================
-- PART 5: VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Insurance Simplification Migration Complete ===';
  RAISE NOTICE 'Created: insurance_requests_simple';
  RAISE NOTICE 'Created: insurance_admin_contacts (if not exists)';
  RAISE NOTICE 'Archived: OCR-related tables (renamed with _archived suffix)';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. UPDATE insurance_admin_contacts with real WhatsApp numbers';
  RAISE NOTICE '2. Deploy simplified wa-webhook-insurance function';
  RAISE NOTICE '3. Delete unified-ocr function (no longer needed)';
  RAISE NOTICE '4. After validation, DROP archived tables';
END $$;

COMMIT;
