BEGIN;

-- ============================================================================
-- INSURANCE INFRASTRUCTURE MIGRATION
-- Generated: 2025-12-14T10:00:00Z
-- Purpose: Create essential tables for insurance workflow go-live
-- ============================================================================

-- ============================================================================
-- 1. PROCESSED WEBHOOKS (Message Deduplication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  phone_number TEXT,
  webhook_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient duplicate checking
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_message_type_time
  ON public.processed_webhooks(message_id, webhook_type, created_at DESC);

-- Auto-cleanup old records (5 minute window is checked in code)
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_created_at
  ON public.processed_webhooks(created_at);

-- Enable RLS
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "service_role_manage_processed_webhooks" ON public.processed_webhooks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. INSURANCE ADMIN CONTACTS
-- ============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_category
  ON public.insurance_admin_contacts(category, is_active)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_insurance_admin_contacts" ON public.insurance_admin_contacts
  FOR ALL USING (auth.role() = 'service_role');

-- Read policy for authenticated users
CREATE POLICY "authenticated_read_insurance_admin_contacts" ON public.insurance_admin_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. INSURANCE CLAIMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  whatsapp TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  description TEXT,
  documents TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted' 
    CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'pending_info', 'closed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_claims_whatsapp ON public.insurance_claims(whatsapp);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_submitted_at ON public.insurance_claims(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_insurance_claims" ON public.insurance_claims
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. INSURANCE ADMIN NOTIFICATIONS (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insurance_admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.insurance_admin_contacts(id) ON DELETE SET NULL,
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  error TEXT,
  payload JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_contact_id
  ON public.insurance_admin_notifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_status
  ON public.insurance_admin_notifications(status)
  WHERE status = 'queued';

-- Enable RLS
ALTER TABLE public.insurance_admin_notifications ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_insurance_admin_notifications" ON public.insurance_admin_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. FEATURE GATE AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_gate_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  rule_hit TEXT,
  msisdn TEXT,
  detected_country TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_gate_audit_feature ON public.feature_gate_audit(feature);
CREATE INDEX IF NOT EXISTS idx_feature_gate_audit_created_at ON public.feature_gate_audit(created_at DESC);

-- Enable RLS
ALTER TABLE public.feature_gate_audit ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_feature_gate_audit" ON public.feature_gate_audit
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. APP CONFIG (For Feature Gates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  insurance_allowed_countries TEXT[] DEFAULT ARRAY['RW'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_config_singleton CHECK (id = 1)
);

-- Insert singleton row if not exists
INSERT INTO public.app_config (id, insurance_allowed_countries)
VALUES (1, ARRAY['RW', 'KE', 'UG', 'TZ'])
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_app_config" ON public.app_config
  FOR ALL USING (auth.role() = 'service_role');

-- Read policy for authenticated and anon
CREATE POLICY "public_read_app_config" ON public.app_config
  FOR SELECT USING (true);

-- ============================================================================
-- 7. HELPER FUNCTION FOR ADMIN CONTACTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_contacts(
  p_category TEXT DEFAULT 'insurance',
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO service_role;

-- ============================================================================
-- 8. SEED DATA - Default Insurance Admin Contact
-- ============================================================================

-- Insert a default insurance admin contact if none exists
INSERT INTO public.insurance_admin_contacts (
  channel, 
  destination, 
  display_name, 
  category, 
  display_order, 
  priority,
  is_active
) VALUES
  ('whatsapp', '+250788767816', 'Insurance Team', 'insurance', 1, 10, true)
ON CONFLICT (destination) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.processed_webhooks IS 'Deduplication table for WhatsApp webhook messages';
COMMENT ON TABLE public.insurance_admin_contacts IS 'Admin/support contacts for insurance notifications';
COMMENT ON TABLE public.insurance_claims IS 'Insurance claim submissions from WhatsApp users';
COMMENT ON TABLE public.insurance_admin_notifications IS 'Audit trail for admin notifications sent';
COMMENT ON TABLE public.feature_gate_audit IS 'Audit log for feature gate decisions';
COMMENT ON TABLE public.app_config IS 'Application configuration (singleton pattern)';

COMMIT;
