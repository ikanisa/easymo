-- Search alerts for saved searches with notifications
CREATE TABLE IF NOT EXISTS search_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  search_type TEXT NOT NULL CHECK (search_type IN ('job', 'property')),
  search_criteria JSONB NOT NULL,
  last_notified_at TIMESTAMPTZ,
  notification_frequency TEXT DEFAULT 'daily' CHECK (notification_frequency IN ('instant', 'daily', 'weekly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_alerts_user ON search_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_search_alerts_active ON search_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_search_alerts_type ON search_alerts(search_type);
CREATE INDEX IF NOT EXISTS idx_search_alerts_frequency ON search_alerts(notification_frequency);

-- RLS policies
ALTER TABLE search_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alerts" ON search_alerts;
CREATE POLICY "Users can view own alerts"
  ON search_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own alerts" ON search_alerts;
CREATE POLICY "Users can create own alerts"
  ON search_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own alerts" ON search_alerts;
CREATE POLICY "Users can update own alerts"
  ON search_alerts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own alerts" ON search_alerts;
CREATE POLICY "Users can delete own alerts"
  ON search_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_search_alerts_updated_at ON search_alerts;
CREATE TRIGGER update_search_alerts_updated_at
  BEFORE UPDATE ON search_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE search_alerts IS 'Stores saved searches with notification preferences';
COMMENT ON COLUMN search_alerts.search_criteria IS 'JSONB object containing search filters (location, price, type, etc.)';
COMMENT ON COLUMN search_alerts.notification_frequency IS 'How often to check for new matches: instant (hourly), daily, or weekly';
