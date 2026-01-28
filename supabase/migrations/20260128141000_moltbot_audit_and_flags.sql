-- =============================================================================
-- Moltbot Audit Events Table
-- Workflow 03: Complete auditability for all Moltbot decisions and tool calls
-- =============================================================================

BEGIN;

-- =============================================================================
-- Audit Events Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request linkage (optional — some events are conversation-level)
  request_id UUID REFERENCES public.moltbot_marketplace_requests(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.moltbot_conversations(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system', -- 'moltbot', 'system', 'admin', 'client', 'vendor'
  
  -- Tool call tracking
  tool_name TEXT,
  idempotency_key TEXT,
  
  -- Input/output hashes for reproducibility
  input_hash TEXT,
  output_hash TEXT,
  
  -- Performance tracking
  duration_ms INT,
  success BOOLEAN DEFAULT true,
  
  -- Detailed data (JSONB for flexibility)
  details JSONB DEFAULT '{}',
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_moltbot_audit_request 
  ON public.moltbot_audit_events(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moltbot_audit_conversation 
  ON public.moltbot_audit_events(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moltbot_audit_event_type 
  ON public.moltbot_audit_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moltbot_audit_tool 
  ON public.moltbot_audit_events(tool_name, created_at DESC);

-- =============================================================================
-- Feature Flags Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Flag identity
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- State
  enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  scope TEXT DEFAULT 'global', -- 'global', 'tenant', 'user'
  scope_id TEXT, -- tenant_id or user_id if scoped
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.feature_flags;
CREATE TRIGGER trigger_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.moltbot_set_updated_at();

-- =============================================================================
-- Seed Default Feature Flags (AI OFF by default)
-- =============================================================================

INSERT INTO public.feature_flags (name, description, enabled)
VALUES
  ('AI_CONCIERGE_ENABLED', 'Enable Moltbot AI decision loop', false),
  ('OCR_ENABLED', 'Enable OCR processing for images/documents', false),
  ('CALLING_ENABLED', 'Enable WhatsApp voice calling', false)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE public.moltbot_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "service_role_full_moltbot_audit_events" ON public.moltbot_audit_events;
CREATE POLICY "service_role_full_moltbot_audit_events"
  ON public.moltbot_audit_events FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_feature_flags" ON public.feature_flags;
CREATE POLICY "service_role_full_feature_flags"
  ON public.feature_flags FOR ALL
  USING (auth.role() = 'service_role');

-- Grants
GRANT ALL ON public.moltbot_audit_events TO service_role;
GRANT ALL ON public.feature_flags TO service_role;

COMMIT;
