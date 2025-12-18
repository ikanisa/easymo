-- =============================================================================
-- Insurance Contacts Reconciliation
-- Purpose: Ensure insurance_admin_contacts exists with expected shape for
--          wa-webhook-insurance even if prior migrations dropped/renamed it.
--          If admin_contacts exists, seed from category='insurance'.
-- =============================================================================

BEGIN;

-- Recreate insurance_admin_contacts if missing
CREATE TABLE IF NOT EXISTS public.insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  destination TEXT NOT NULL UNIQUE,
  display_name TEXT,
  category TEXT DEFAULT 'insurance'
    CHECK (category IN ('support', 'admin_auth', 'insurance', 'general', 'escalation')),
  display_order INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If admin_contacts table exists, seed insurance contacts from it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_contacts'
  ) THEN
    INSERT INTO public.insurance_admin_contacts (
      destination, display_name, category, is_active, priority, display_order
    )
    SELECT
      phone_number,
      name,
      'insurance',
      COALESCE(is_active, true),
      100,
      1
    FROM public.admin_contacts
    WHERE category = 'insurance'
    ON CONFLICT (destination) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          is_active = EXCLUDED.is_active,
          updated_at = now();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_category_active
  ON public.insurance_admin_contacts(category, is_active);

-- Enable RLS and service-role policy
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_insurance_admin_contacts" ON public.insurance_admin_contacts;
CREATE POLICY "service_role_manage_insurance_admin_contacts"
  ON public.insurance_admin_contacts FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
