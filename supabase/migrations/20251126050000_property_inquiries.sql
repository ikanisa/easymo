BEGIN;

-- Property Inquiries table for contact/inquiry system
CREATE TABLE IF NOT EXISTS public.property_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES property_listings(id) ON DELETE CASCADE,
  inquirer_phone TEXT NOT NULL,
  inquirer_user_id UUID,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_inquiries_property ON property_inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_inquirer ON property_inquiries(inquirer_phone);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON property_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_user ON property_inquiries(inquirer_user_id) WHERE inquirer_user_id IS NOT NULL;

-- RLS
ALTER TABLE property_inquiries ENABLE ROW LEVEL SECURITY;

-- Users can view inquiries they sent
CREATE POLICY property_inquiries_select_own ON property_inquiries
  FOR SELECT
  USING (inquirer_phone = current_setting('request.headers')::json->>'x-user-phone');

-- Property owners can view inquiries for their properties
CREATE POLICY property_inquiries_select_owner ON property_inquiries
  FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM property_listings 
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY property_inquiries_service_all ON property_inquiries
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON property_inquiries TO service_role;
GRANT SELECT ON property_inquiries TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_property_inquiries_updated_at
  BEFORE UPDATE ON property_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE property_inquiries IS 'Tracks property viewing inquiries and contact requests';

COMMIT;
