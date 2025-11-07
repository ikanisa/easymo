-- Migration: OpenAI Agents SDK Integration
-- Creates tables for agent execution traces and tool invocations
-- This is an ADDITIVE migration - no existing tables are modified

BEGIN;

-- Create agent_traces table for storing agent execution logs
CREATE TABLE IF NOT EXISTS agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  session_id UUID,
  query TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER NOT NULL,
  tools_invoked TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on agent_name for performance
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_name ON agent_traces(agent_name);

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_id ON agent_traces(user_id);

-- Create index on session_id for session tracking
CREATE INDEX IF NOT EXISTS idx_agent_traces_session_id ON agent_traces(session_id) WHERE session_id IS NOT NULL;

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON agent_traces(created_at DESC);

-- Enable Row Level Security
ALTER TABLE agent_traces ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own traces
CREATE POLICY agent_traces_select_own
  ON agent_traces
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can view all traces (for admin/analytics)
CREATE POLICY agent_traces_select_service
  ON agent_traces
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policy: Service role can insert traces (from Edge Functions)
CREATE POLICY agent_traces_insert_service
  ON agent_traces
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Create agent_tools table for tool registry (optional, for future use)
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_agent_tools_name ON agent_tools(name);

-- Create index on enabled for filtering
CREATE INDEX IF NOT EXISTS idx_agent_tools_enabled ON agent_tools(enabled) WHERE enabled = true;

-- Enable Row Level Security
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view enabled tools
CREATE POLICY agent_tools_select_enabled
  ON agent_tools
  FOR SELECT
  USING (enabled = true OR auth.jwt() ->> 'role' = 'service_role');

-- RLS Policy: Only service role can modify tools
CREATE POLICY agent_tools_modify_service
  ON agent_tools
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to agent_traces
CREATE TRIGGER agent_traces_updated_at
  BEFORE UPDATE ON agent_traces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to agent_tools
CREATE TRIGGER agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default tool definitions
INSERT INTO agent_tools (name, description, parameters, metadata) VALUES
  ('WebSearch', 'Search the web for current information, news, or general knowledge', 
   '{"query": "string", "maxResults": "number"}'::jsonb,
   '{"category": "search"}'::jsonb),
  ('MenuLookup', 'Search for drinks, food, or products available on the menu',
   '{"query": "string", "category": "enum", "limit": "number"}'::jsonb,
   '{"category": "menu"}'::jsonb),
  ('CheckAvailability', 'Check available time slots for bar-truck bookings on a specific date',
   '{"date": "string", "location": "string"}'::jsonb,
   '{"category": "booking"}'::jsonb),
  ('CreateBooking', 'Create a new booking for a bar-truck time slot',
   '{"slotId": "uuid", "guestCount": "number", "specialRequests": "string"}'::jsonb,
   '{"category": "booking"}'::jsonb),
  ('CheckBalance', 'Check user token, voucher, or credit balance',
   '{"tokenType": "enum"}'::jsonb,
   '{"category": "redemption"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON agent_traces TO authenticated, anon;
GRANT INSERT ON agent_traces TO service_role;
GRANT ALL ON agent_tools TO service_role;
GRANT SELECT ON agent_tools TO authenticated, anon;

COMMIT;
