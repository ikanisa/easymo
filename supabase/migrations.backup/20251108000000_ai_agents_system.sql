-- AI Agents System Tables Migration
-- Creates tables for agent sessions, conversations, and analytics

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent Sessions Table
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('nearby_drivers', 'pharmacy', 'quincaillerie', 'shops', 'property_rental', 'schedule_trip', 'waiter')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'searching', 'negotiating', 'presenting', 'completed', 'timeout', 'cancelled')),
  request_data JSONB NOT NULL DEFAULT '{}',
  response_data JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  selected_quote_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Quotes Table
CREATE TABLE IF NOT EXISTS agent_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  vendor_id UUID,
  vendor_type TEXT NOT NULL,
  offer_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Conversations Table
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Metrics Table
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Negotiations Table
CREATE TABLE IF NOT EXISTS agent_negotiations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES agent_quotes(id) ON DELETE CASCADE,
  vendor_id UUID,
  original_price NUMERIC(10,2),
  counter_price NUMERIC(10,2),
  final_price NUMERIC(10,2),
  negotiation_rounds INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Travel Patterns Table (for Schedule Trip agent)
CREATE TABLE IF NOT EXISTS travel_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  hour INT CHECK (hour BETWEEN 0 AND 23),
  pickup_location JSONB,
  dropoff_location JSONB,
  vehicle_type TEXT,
  frequency INT DEFAULT 1,
  last_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Property Listings (for Property Rental agent)
CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  rental_type TEXT NOT NULL CHECK (rental_type IN ('short_term', 'long_term')),
  bedrooms INT,
  bathrooms INT,
  price NUMERIC(10,2),
  location JSONB NOT NULL,
  address TEXT,
  amenities TEXT[],
  images TEXT[],
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance')),
  available_from DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled Trips Table
CREATE TABLE IF NOT EXISTS scheduled_trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  pickup_location JSONB NOT NULL,
  dropoff_location JSONB NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  vehicle_preference TEXT,
  recurrence TEXT DEFAULT 'once' CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekends', 'weekly')),
  is_active BOOLEAN DEFAULT TRUE,
  notification_preference INT DEFAULT 30,
  flexibility_window INT DEFAULT 15,
  max_price NUMERIC(10,2),
  preferred_drivers UUID[],
  notes TEXT,
  last_processed TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_type ON agent_sessions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started_at ON agent_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_quotes_session_id ON agent_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_vendor_id ON agent_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_status ON agent_quotes(status);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_session_id ON agent_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at ON agent_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_type ON agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_recorded_at ON agent_metrics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_travel_patterns_user_id ON travel_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_patterns_day_hour ON travel_patterns(day_of_week, hour);

CREATE INDEX IF NOT EXISTS idx_property_listings_owner_id ON property_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON property_listings(status);
CREATE INDEX IF NOT EXISTS idx_property_listings_rental_type ON property_listings(rental_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user_id ON scheduled_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_scheduled_time ON scheduled_trips(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_is_active ON scheduled_trips(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_quotes_updated_at BEFORE UPDATE ON agent_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_negotiations_updated_at BEFORE UPDATE ON agent_negotiations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_travel_patterns_updated_at BEFORE UPDATE ON travel_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_listings_updated_at BEFORE UPDATE ON property_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_trips_updated_at BEFORE UPDATE ON scheduled_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Add comments for documentation
COMMENT ON TABLE agent_sessions IS 'Stores active and completed AI agent sessions';
COMMENT ON TABLE agent_quotes IS 'Stores vendor quotes collected by AI agents';
COMMENT ON TABLE agent_conversations IS 'Stores conversation history between users and AI agents';
COMMENT ON TABLE agent_metrics IS 'Stores performance metrics for AI agents';
COMMENT ON TABLE agent_negotiations IS 'Tracks price negotiations between agents and vendors';
COMMENT ON TABLE travel_patterns IS 'ML data for learning user travel patterns';
COMMENT ON TABLE property_listings IS 'Property rental listings managed by AI agent';
COMMENT ON TABLE scheduled_trips IS 'User scheduled trips managed by AI agent';
