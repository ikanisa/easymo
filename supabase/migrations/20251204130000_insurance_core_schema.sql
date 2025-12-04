-- Insurance Core Schema - Complete Database Foundation
BEGIN;

-- CREATE INSURANCE_LEADS TABLE
CREATE TABLE IF NOT EXISTS public.insurance_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  whatsapp TEXT,
  file_path TEXT,
  raw_ocr JSONB,
  extracted JSONB,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'ocr_ok', 'ocr_error', 'pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_leads_user ON public.insurance_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_leads_status ON public.insurance_leads(status);
CREATE INDEX IF NOT EXISTS idx_insurance_leads_whatsapp ON public.insurance_leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_insurance_leads_created ON public.insurance_leads(created_at DESC);

-- CREATE INSURANCE_MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.insurance_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  wa_media_id TEXT UNIQUE,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_media_lead ON public.insurance_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_insurance_media_wa_id ON public.insurance_media(wa_media_id);

-- CREATE INSURANCE_MEDIA_QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.insurance_media_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  wa_id TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  caption TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'retry', 'succeeded', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_queue_status ON public.insurance_media_queue(status) WHERE status IN ('queued', 'retry');
CREATE INDEX IF NOT EXISTS idx_insurance_queue_lead ON public.insurance_media_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_insurance_queue_created ON public.insurance_media_queue(created_at ASC);

-- CREATE INSURANCE_QUOTES TABLE
CREATE TABLE IF NOT EXISTS public.insurance_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  uploaded_docs TEXT[],
  insurer TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quotes_user ON public.insurance_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_status ON public.insurance_quotes(status);

-- CREATE INSURANCE_CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  whatsapp TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('claim_accident', 'claim_theft', 'claim_damage', 'claim_third_party')),
  description TEXT NOT NULL,
  documents JSONB,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'pending_info', 'closed')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_user ON public.insurance_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_whatsapp ON public.insurance_claims(whatsapp);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_submitted ON public.insurance_claims(submitted_at DESC);

-- CREATE INSURANCE_ADMIN_CONTACTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_active ON public.insurance_admin_contacts(is_active) WHERE is_active = TRUE;

-- CREATE INSURANCE_RENEWALS TABLE
CREATE TABLE IF NOT EXISTS public.insurance_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reminder_days INTEGER NOT NULL CHECK (reminder_days IN (1, 3, 7)),
  sent_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'acknowledged', 'renewed', 'expired')),
  policy_expiry DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_renewals_lead ON public.insurance_renewals(lead_id);
CREATE INDEX IF NOT EXISTS idx_insurance_renewals_user ON public.insurance_renewals(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_renewals_unique ON public.insurance_renewals(lead_id, reminder_days);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_renewals ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES
DROP POLICY IF EXISTS insurance_leads_select_own ON public.insurance_leads;
CREATE POLICY insurance_leads_select_own ON public.insurance_leads
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS insurance_leads_insert_service ON public.insurance_leads;
CREATE POLICY insurance_leads_insert_service ON public.insurance_leads
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS insurance_leads_update_service ON public.insurance_leads;
CREATE POLICY insurance_leads_update_service ON public.insurance_leads
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS insurance_media_select_own ON public.insurance_media;
CREATE POLICY insurance_media_select_own ON public.insurance_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM insurance_leads il 
      WHERE il.id = insurance_media.lead_id 
        AND (il.user_id = auth.uid() OR auth.role() = 'service_role')
    )
  );

DROP POLICY IF EXISTS insurance_claims_select_own ON public.insurance_claims;
CREATE POLICY insurance_claims_select_own ON public.insurance_claims
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS insurance_claims_insert_own ON public.insurance_claims;
CREATE POLICY insurance_claims_insert_own ON public.insurance_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS insurance_media_queue_service ON public.insurance_media_queue;
CREATE POLICY insurance_media_queue_service ON public.insurance_media_queue
  FOR ALL USING (auth.role() = 'service_role');

-- CREATE RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_expiring_policies(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  lead_id UUID,
  user_id UUID,
  wa_id TEXT,
  policy_expiry DATE,
  insurer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.id AS lead_id,
    il.user_id,
    il.whatsapp AS wa_id,
    (il.extracted->>'policy_expiry')::DATE AS policy_expiry,
    il.extracted->>'insurer_name' AS insurer_name
  FROM public.insurance_leads il
  WHERE il.status = 'approved'
    AND il.extracted IS NOT NULL
    AND il.extracted->>'policy_expiry' IS NOT NULL
    AND (il.extracted->>'policy_expiry')::DATE 
      BETWEEN CURRENT_DATE AND CURRENT_DATE + days_ahead
    AND NOT EXISTS (
      SELECT 1 FROM public.insurance_renewals ir
      WHERE ir.lead_id = il.id
        AND ir.reminder_days = days_ahead
        AND ir.sent_at > NOW() - INTERVAL '24 hours'
    )
  ORDER BY (il.extracted->>'policy_expiry')::DATE ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_expiring_policies TO service_role, authenticated;

-- SEED ADMIN CONTACTS
-- Real admin numbers loaded from insurance_admin_contacts table
-- Add more admins via SQL or admin panel
INSERT INTO public.insurance_admin_contacts (contact_type, contact_value, display_name, display_order, is_active) VALUES
  ('whatsapp', '+250795588248', 'Insurance Support Team 1', 1, true),
  ('whatsapp', '+250793094876', 'Insurance Support Team 2', 2, true),
  ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true),
  ('email', 'insurance@easymo.rw', 'Insurance Email', 10, true)
ON CONFLICT DO NOTHING;

COMMIT;
