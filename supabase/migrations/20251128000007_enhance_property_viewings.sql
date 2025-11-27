-- Enhance property_viewings for WhatsApp integration
ALTER TABLE property_viewings 
  ADD COLUMN IF NOT EXISTS whatsapp_user_id UUID REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'cancelled', 'completed'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_viewings_whatsapp_user ON property_viewings(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_property_viewings_status ON property_viewings(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_property_viewings_date ON property_viewings(viewing_date);
CREATE INDEX IF NOT EXISTS idx_property_viewings_reminders ON property_viewings(viewing_date, reminder_sent) 
  WHERE reminder_sent = false AND confirmation_status = 'confirmed';

-- Comments
COMMENT ON COLUMN property_viewings.whatsapp_user_id IS 'WhatsApp user who scheduled the viewing';
COMMENT ON COLUMN property_viewings.reminder_sent IS 'Whether 24h reminder has been sent';
COMMENT ON COLUMN property_viewings.confirmation_status IS 'Status of the viewing appointment';
