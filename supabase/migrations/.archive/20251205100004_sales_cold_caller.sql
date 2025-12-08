-- ============================================================================
-- Sales / Cold Caller Schema
-- Campaign-based outbound calls with structured claim capture
-- Based on microsoft/call-center-ai patterns
-- ============================================================================

BEGIN;

-- Call disposition enum
DO $$ BEGIN
  CREATE TYPE call_disposition AS ENUM (
    'INTERESTED',
    'NOT_INTERESTED', 
    'CALL_BACK',
    'NO_ANSWER',
    'DO_NOT_CALL',
    'WRONG_NUMBER',
    'VOICEMAIL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Sales campaigns table
CREATE TABLE IF NOT EXISTS sales_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign identity
  name TEXT NOT NULL,
  description TEXT,
  segment TEXT NOT NULL,                -- 'pharmacies', 'bars', 'moto_drivers', 'restaurants', etc.
  
  -- Campaign goals
  script_goal TEXT NOT NULL,            -- What we want from the call
  target_outcome TEXT,                  -- Expected success metric
  
  -- Claim schema (fields to collect during call)
  claim_schema JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of { name, type, required, enum_values }
  
  -- Campaign rules
  max_attempts INTEGER DEFAULT 3,
  call_window_start TIME DEFAULT '09:00:00',
  call_window_end TIME DEFAULT '18:00:00',
  call_window_timezone TEXT DEFAULT 'Africa/Kigali',
  cooldown_minutes INTEGER DEFAULT 60,  -- Min time between calls to same lead
  
  -- Voice settings
  language TEXT DEFAULT 'rw',
  voice_style TEXT,                     -- 'professional', 'friendly', 'urgent'
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_segment ON sales_campaigns(segment);
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_status ON sales_campaigns(status);

-- Sales leads table
CREATE TABLE IF NOT EXISTS sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lead identity
  segment TEXT,                         -- 'pharmacy','bar','moto_driver', etc.
  business_name TEXT,
  contact_name TEXT,
  
  -- Contact info
  phone_number TEXT NOT NULL,
  whatsapp_number TEXT,
  email TEXT,
  
  -- Business details
  category TEXT,
  subcategory TEXT,
  
  -- Location
  location_country TEXT DEFAULT 'Rwanda',
  location_district TEXT,
  location_sector TEXT,
  location_address TEXT,
  coordinates GEOGRAPHY(POINT, 4326),
  
  -- Tags and metadata
  tags TEXT[],
  source TEXT,                          -- 'import', 'referral', 'signup', 'scrape'
  source_id TEXT,                       -- External reference
  
  -- Opt-out
  opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  opt_out_reason TEXT,
  
  -- Lifecycle
  lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'dormant')),
  qualified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_leads_segment ON sales_leads(segment);
CREATE INDEX IF NOT EXISTS idx_sales_leads_phone ON sales_leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON sales_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_opted_out ON sales_leads(opted_out) WHERE opted_out = false;
CREATE INDEX IF NOT EXISTS idx_sales_leads_location ON sales_leads(location_district);
CREATE INDEX IF NOT EXISTS idx_sales_leads_tags ON sales_leads USING GIN (tags);

-- Sales call interactions table
CREATE TABLE IF NOT EXISTS sales_call_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES sales_leads(id),
  campaign_id UUID REFERENCES sales_campaigns(id),
  
  -- Call outcome
  disposition call_disposition NOT NULL,
  disposition_notes TEXT,
  
  -- Follow-up
  follow_up_at TIMESTAMPTZ,
  follow_up_notes TEXT,
  follow_up_completed BOOLEAN DEFAULT false,
  
  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_interactions_call ON sales_call_interactions(call_id);
CREATE INDEX IF NOT EXISTS idx_sales_interactions_lead ON sales_call_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_interactions_campaign ON sales_call_interactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_interactions_disposition ON sales_call_interactions(disposition);
CREATE INDEX IF NOT EXISTS idx_sales_interactions_follow_up ON sales_call_interactions(follow_up_at) 
  WHERE follow_up_at IS NOT NULL AND follow_up_completed = false;

-- Sales claims table (structured field capture during calls)
CREATE TABLE IF NOT EXISTS sales_claims (
  id BIGSERIAL PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  
  -- Claim data (key-value from campaign's claim_schema)
  key TEXT NOT NULL,
  value TEXT,
  value_type TEXT,                      -- 'text', 'integer', 'boolean', 'date', 'enum'
  
  -- Confidence (if extracted by AI)
  confidence NUMERIC(4,3),
  confirmed_by_user BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_claims_call ON sales_claims(call_id);
CREATE INDEX IF NOT EXISTS idx_sales_claims_key ON sales_claims(key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_claims_call_key ON sales_claims(call_id, key);

-- Comments
COMMENT ON TABLE sales_campaigns IS 'Outbound call campaign configurations';
COMMENT ON COLUMN sales_campaigns.claim_schema IS 'JSON array defining fields to collect: [{name, type, required}]';
COMMENT ON COLUMN sales_campaigns.max_attempts IS 'Maximum call attempts per lead';

COMMENT ON TABLE sales_leads IS 'Potential customers for outbound campaigns';
COMMENT ON COLUMN sales_leads.segment IS 'Business segment (pharmacy, bar, moto_driver, etc.)';
COMMENT ON COLUMN sales_leads.opted_out IS 'Lead has requested no further calls';

COMMENT ON TABLE sales_call_interactions IS 'Outcome of each sales call attempt';
COMMENT ON COLUMN sales_call_interactions.disposition IS 'Call result classification';
COMMENT ON COLUMN sales_call_interactions.follow_up_at IS 'Scheduled follow-up time if CALL_BACK';

COMMENT ON TABLE sales_claims IS 'Structured data captured during calls based on campaign claim_schema';
COMMENT ON COLUMN sales_claims.key IS 'Field name from claim_schema';
COMMENT ON COLUMN sales_claims.value IS 'Captured value as string';

-- Enable RLS
ALTER TABLE sales_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_call_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_claims ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Service role can manage campaigns" ON sales_campaigns;
CREATE POLICY "Service role can manage campaigns"
  ON sales_campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view active campaigns" ON sales_campaigns;
CREATE POLICY "Authenticated users can view active campaigns"
  ON sales_campaigns FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'active');

DROP POLICY IF EXISTS "Service role can manage leads" ON sales_leads;
CREATE POLICY "Service role can manage leads"
  ON sales_leads FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage interactions" ON sales_call_interactions;
CREATE POLICY "Service role can manage interactions"
  ON sales_call_interactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage claims" ON sales_claims;
CREATE POLICY "Service role can manage claims"
  ON sales_claims FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
