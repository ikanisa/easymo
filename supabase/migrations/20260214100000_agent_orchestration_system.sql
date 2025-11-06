-- Agent Orchestration System Tables
-- Migration for AI agent session management, vendor quotes, and agent configuration
BEGIN;

-- ============================================================================
-- Agent Registry: Central catalog of all 14 AI agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL UNIQUE, -- 'driver_negotiation', 'pharmacy_sourcing', etc.
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  sla_minutes INTEGER DEFAULT 5,
  max_extensions INTEGER DEFAULT 2,
  fan_out_limit INTEGER DEFAULT 10,
  counter_offer_delta_pct INTEGER DEFAULT 15,
  auto_negotiation BOOLEAN DEFAULT FALSE,
  feature_flag_scope TEXT DEFAULT 'disabled', -- 'disabled', 'staging', 'prod_10%', 'prod_100%'
  system_prompt TEXT,
  enabled_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_registry_type ON agent_registry(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_registry_enabled ON agent_registry(enabled);

-- ============================================================================
-- Agent Sessions: Track active negotiation/sourcing sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  agent_type TEXT NOT NULL REFERENCES agent_registry(agent_type),
  flow_type TEXT NOT NULL, -- 'driver_negotiation', 'pharmacy_sourcing', etc.
  status TEXT NOT NULL DEFAULT 'searching', -- 'searching', 'negotiating', 'completed', 'timeout', 'cancelled'
  request_data JSONB NOT NULL, -- pickup, dropoff, vehicle, product_list, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  extensions_count INTEGER DEFAULT 0,
  selected_quote_id UUID,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_type ON agent_sessions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_flow_type ON agent_sessions(flow_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_deadline ON agent_sessions(deadline_at) WHERE status = 'searching';
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started ON agent_sessions(started_at DESC);

-- ============================================================================
-- Agent Quotes: Vendor responses for sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  vendor_id UUID, -- Reference to vendor in respective vendor tables
  vendor_type TEXT NOT NULL, -- 'driver', 'pharmacy', 'quincaillerie', 'shop'
  vendor_name TEXT,
  offer_data JSONB NOT NULL, -- price, eta, availability, terms, etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'counter_offered'
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ranking_score DECIMAL(5,2),
  counter_offer_data JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote queries
CREATE INDEX IF NOT EXISTS idx_agent_quotes_session ON agent_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_vendor ON agent_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_status ON agent_quotes(status);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_responded ON agent_quotes(responded_at DESC);

-- ============================================================================
-- Vendor Quote Responses: Raw vendor communication log
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_quote_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES agent_quotes(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  vendor_type TEXT NOT NULL,
  request_message TEXT, -- Message sent to vendor
  response_message TEXT, -- Raw vendor response
  response_parsed JSONB, -- Parsed structured data
  channel TEXT NOT NULL, -- 'whatsapp', 'sms', 'ussd'
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for response queries
CREATE INDEX IF NOT EXISTS idx_vendor_responses_session ON vendor_quote_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_vendor_responses_vendor ON vendor_quote_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_responses_received ON vendor_quote_responses(received_at DESC);

-- ============================================================================
-- Sales Campaigns: Marketing agent campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL, -- 'drivers', 'vendors', 'users'
  channel TEXT NOT NULL, -- 'whatsapp', 'sms', 'email'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  template_id TEXT,
  message_template TEXT,
  target_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  optout_count INTEGER DEFAULT 0,
  rate_limit_per_day INTEGER DEFAULT 500,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_campaigns_status ON sales_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_segment ON sales_campaigns(segment);

-- ============================================================================
-- Sales Contacts: Campaign contact tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sales_campaigns(id) ON DELETE CASCADE,
  contact_name TEXT,
  phone_number TEXT,
  email TEXT,
  segment TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_contacts_campaign ON sales_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_phone ON sales_contacts(phone_number);

-- ============================================================================
-- Sales Tasks: Outreach activity log
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sales_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES sales_contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  template TEXT,
  message_sent TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'replied', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_text TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_tasks_campaign ON sales_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_contact ON sales_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_status ON sales_tasks(status);

-- ============================================================================
-- Call Logs: Voice agent call tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  vendor_id UUID,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'outbound', 'inbound'
  duration_seconds INTEGER,
  status TEXT NOT NULL, -- 'initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'
  recording_url TEXT,
  transcript TEXT,
  call_sid TEXT UNIQUE, -- Twilio call SID
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_session ON call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_vendor ON call_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);

-- ============================================================================
-- Agent Metrics: Performance tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL REFERENCES agent_registry(agent_type),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  timeout_sessions INTEGER DEFAULT 0,
  cancelled_sessions INTEGER DEFAULT 0,
  avg_time_to_3_quotes_seconds INTEGER,
  avg_quotes_per_session DECIMAL(5,2),
  acceptance_rate_pct DECIMAL(5,2),
  avg_response_time_seconds INTEGER,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_type, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_date ON agent_metrics(metric_date DESC);

-- ============================================================================
-- Tool Catalog: Available tools for agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tool_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'vendor_lookup', 'negotiation', 'payment', 'notification'
  description TEXT,
  json_schema JSONB NOT NULL,
  rate_limit_per_minute INTEGER,
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_catalog_category ON agent_tool_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tool_catalog_enabled ON agent_tool_catalog(enabled);

-- ============================================================================
-- Seed initial agent registry data
-- ============================================================================
INSERT INTO agent_registry (agent_type, name, description, sla_minutes) VALUES
  ('driver_negotiation', 'Driver Negotiation Agent', 'Negotiates with nearby drivers to get best quotes', 5),
  ('pharmacy_sourcing', 'Pharmacy Sourcing Agent', 'Sources products from nearby pharmacies', 5),
  ('quincaillerie_sourcing', 'Hardware Store Agent', 'Sources hardware from quincailleries', 5),
  ('shop_sourcing', 'Shop Sourcing Agent', 'Sources products from shops', 5),
  ('scheduled_trip', 'Scheduled Trip Agent', 'Manages pre-scheduled trip matching', 10),
  ('sales_marketing', 'Sales & Marketing Agent', 'Handles outreach campaigns', 0),
  ('property_rental', 'Property Rental Agent', 'Matches rental properties', 10),
  ('bar_waiter', 'Bar Waiter Agent', 'Conversational menu ordering', 0),
  ('restaurant_waiter', 'Restaurant Waiter Agent', 'Conversational menu ordering', 0),
  ('delivery_coordination', 'Delivery Coordination Agent', 'Coordinates deliveries', 5),
  ('customer_support', 'Customer Support Agent', 'Handles support inquiries', 0),
  ('price_negotiation', 'Price Negotiation Agent', 'Negotiates prices with vendors', 5),
  ('availability_checker', 'Availability Checker Agent', 'Checks vendor availability', 2),
  ('review_collector', 'Review Collection Agent', 'Collects feedback and reviews', 0)
ON CONFLICT (agent_type) DO NOTHING;

-- ============================================================================
-- RLS Policies (Admin-only access)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_catalog ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (service_role bypass is automatic)
CREATE POLICY "Admin full access to agent_registry" ON agent_registry FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to agent_sessions" ON agent_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to agent_quotes" ON agent_quotes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to vendor_quote_responses" ON vendor_quote_responses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to sales_campaigns" ON sales_campaigns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to sales_contacts" ON sales_contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to sales_tasks" ON sales_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to call_logs" ON call_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to agent_metrics" ON agent_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to agent_tool_catalog" ON agent_tool_catalog FOR ALL USING (auth.role() = 'service_role');

COMMIT;
