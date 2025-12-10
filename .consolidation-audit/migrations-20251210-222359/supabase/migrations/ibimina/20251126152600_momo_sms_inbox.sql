-- MoMo SMS Webhook Infrastructure
-- Creates tables, indexes, RLS policies, and auto-matching logic for
-- receiving and processing Mobile Money SMS relayed from MomoTerminal Android app.

-- Table: momo_webhook_config
-- Stores configuration for each registered MomoTerminal device
CREATE TABLE IF NOT EXISTS app.momo_webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  momo_phone_number TEXT NOT NULL UNIQUE,
  webhook_secret TEXT NOT NULL,
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('UTC', now())
);

COMMENT ON TABLE app.momo_webhook_config IS 'Configuration for MomoTerminal devices that relay SMS';
COMMENT ON COLUMN app.momo_webhook_config.momo_phone_number IS 'Mobile Money phone number receiving SMS';
COMMENT ON COLUMN app.momo_webhook_config.webhook_secret IS 'HMAC secret for signature verification';
COMMENT ON COLUMN app.momo_webhook_config.device_id IS 'Unique device identifier';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS momo_webhook_config_touch_updated_at ON app.momo_webhook_config;
CREATE TRIGGER momo_webhook_config_touch_updated_at
BEFORE UPDATE ON app.momo_webhook_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Table: momo_sms_inbox
-- Stores all incoming MoMo SMS with parsed data
CREATE TABLE IF NOT EXISTS app.momo_sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  sender TEXT,
  raw_message TEXT NOT NULL,
  parsed_amount DECIMAL(15,2),
  parsed_sender_name TEXT,
  parsed_transaction_id TEXT,
  parsed_provider TEXT,              -- 'mtn', 'vodafone', 'airteltigo'
  received_at TIMESTAMPTZ DEFAULT timezone('UTC', now()),
  processed BOOLEAN DEFAULT FALSE,
  matched_payment_id UUID REFERENCES app.payments(id),
  match_confidence DECIMAL(3,2),     -- 0.00 to 1.00
  signature TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('UTC', now())
);

COMMENT ON TABLE app.momo_sms_inbox IS 'Inbox for Mobile Money SMS relayed from Android devices';
COMMENT ON COLUMN app.momo_sms_inbox.phone_number IS 'Phone number that received the SMS';
COMMENT ON COLUMN app.momo_sms_inbox.sender IS 'SMS sender (e.g., MTN MoMo)';
COMMENT ON COLUMN app.momo_sms_inbox.raw_message IS 'Original SMS content';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_amount IS 'Extracted payment amount';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_sender_name IS 'Extracted sender name from SMS';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_transaction_id IS 'Extracted transaction ID';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_provider IS 'Detected mobile money provider';
COMMENT ON COLUMN app.momo_sms_inbox.processed IS 'Whether SMS has been processed';
COMMENT ON COLUMN app.momo_sms_inbox.matched_payment_id IS 'Reference to matched payment record';
COMMENT ON COLUMN app.momo_sms_inbox.match_confidence IS 'Confidence score for auto-matching (0-1)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_phone ON app.momo_sms_inbox(phone_number);
CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_processed ON app.momo_sms_inbox(processed);
CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_received ON app.momo_sms_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_transaction ON app.momo_sms_inbox(parsed_transaction_id);
CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_payment ON app.momo_sms_inbox(matched_payment_id);

-- RLS policies
ALTER TABLE app.momo_sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.momo_webhook_config ENABLE ROW LEVEL SECURITY;

-- Staff can view all SMS
CREATE POLICY "Staff can view momo_sms_inbox" ON app.momo_sms_inbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('ADMIN', 'SACCO_STAFF', 'DISTRICT_MANAGER')
    )
  );

-- Only service role can insert (from webhook)
CREATE POLICY "Service role can insert momo_sms_inbox" ON app.momo_sms_inbox
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update for matching
CREATE POLICY "Service role can update momo_sms_inbox" ON app.momo_sms_inbox
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Staff can view webhook config
CREATE POLICY "Staff can view momo_webhook_config" ON app.momo_webhook_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('ADMIN', 'SACCO_STAFF', 'DISTRICT_MANAGER')
    )
  );

-- Admin can manage webhook config
CREATE POLICY "Admin can manage momo_webhook_config" ON app.momo_webhook_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'ADMIN'
    )
  );

-- Function to auto-match payments
-- Attempts to match incoming SMS to pending payments based on amount and timing
CREATE OR REPLACE FUNCTION app.match_momo_to_payment()
RETURNS TRIGGER AS $$
DECLARE
  matched_id UUID;
  confidence_score DECIMAL(3,2);
BEGIN
  -- Only attempt matching if we successfully parsed an amount
  IF NEW.parsed_amount IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to find a pending payment matching amount and approximate time
  -- Look for payments within the last 24 hours
  SELECT p.id INTO matched_id
  FROM app.payments p
  WHERE p.amount = (NEW.parsed_amount * 100)::bigint  -- Convert to cents/minor units
    AND p.status = 'PENDING'
    AND p.occurred_at > timezone('UTC', now()) - INTERVAL '24 hours'
    AND p.occurred_at <= NEW.received_at
  ORDER BY p.occurred_at DESC
  LIMIT 1;
  
  IF matched_id IS NOT NULL THEN
    -- Calculate confidence based on time proximity
    -- Higher confidence if payment was very recent
    confidence_score := 0.80;  -- Base confidence for amount match
    
    -- Update the SMS record with match
    NEW.matched_payment_id := matched_id;
    NEW.processed := TRUE;
    NEW.match_confidence := confidence_score;
    
    -- Update the payment status
    UPDATE app.payments
    SET status = 'VERIFIED',
        confidence = confidence_score
    WHERE id = matched_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.match_momo_to_payment() IS 'Auto-matches incoming MoMo SMS to pending payments';

-- Trigger for auto-matching
DROP TRIGGER IF EXISTS trigger_match_momo_payment ON app.momo_sms_inbox;
CREATE TRIGGER trigger_match_momo_payment
  BEFORE INSERT ON app.momo_sms_inbox
  FOR EACH ROW
  EXECUTE FUNCTION app.match_momo_to_payment();
