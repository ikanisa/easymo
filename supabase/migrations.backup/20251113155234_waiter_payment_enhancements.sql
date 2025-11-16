BEGIN;

-- ============================================================================
-- Waiter AI PWA - Payment System Enhancements
-- ============================================================================
-- Purpose: Add fields and tables for USSD/Revolut payment flow
-- ============================================================================

-- Step 1: Enhance payments table
-- ============================================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmation_method TEXT DEFAULT 'manual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ussd_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_by_user_at TIMESTAMPTZ;

COMMENT ON COLUMN payments.payment_link IS 'Revolut.me link or payment URL';
COMMENT ON COLUMN payments.payment_instructions IS 'Instructions shown to user (e.g., USSD steps)';
COMMENT ON COLUMN payments.confirmation_method IS 'How payment was confirmed: manual, webhook, automatic';
COMMENT ON COLUMN payments.ussd_code IS 'USSD code for mobile money payment';
COMMENT ON COLUMN payments.confirmed_by_user_at IS 'When user clicked "I have paid"';

-- Add index for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider, provider_reference) 
WHERE provider_reference IS NOT NULL;

-- Step 2: Create user payment methods table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mtn_momo', 'airtel_money', 'revolut', 'cash')),
  phone_number TEXT,
  revolut_link TEXT,
  provider_account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, phone_number),
  CHECK (
    (provider IN ('mtn_momo', 'airtel_money') AND phone_number IS NOT NULL) OR
    (provider = 'revolut' AND revolut_link IS NOT NULL) OR
    (provider = 'cash')
  )
);

CREATE INDEX idx_user_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX idx_user_payment_methods_default ON user_payment_methods(user_id, is_default) 
WHERE is_default = true;

-- Step 3: Restaurant payment settings
-- ============================================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{
  "accepted_methods": ["mtn_momo", "revolut", "cash"],
  "momo_ussd_code": "*182*7*1#",
  "revolut_merchant_link": null,
  "require_payment_confirmation": true,
  "auto_confirm_cash": false
}'::jsonb;

COMMENT ON COLUMN restaurants.payment_settings IS 'Payment configuration per restaurant';

-- Step 4: Payment history/audit table
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (event_type IN (
    'initiated', 'pending', 'user_confirmed', 'webhook_received', 
    'successful', 'failed', 'cancelled', 'refunded'
  ))
);

CREATE INDEX idx_payment_events_payment ON payment_events(payment_id, created_at DESC);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);

-- Step 5: RLS Policies
-- ============================================================================

-- User payment methods: users can manage their own
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_payment_methods_own_crud" ON user_payment_methods
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_payment_methods_service" ON user_payment_methods
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Payment events: users can view their own
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_own_read" ON payment_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM payments 
    WHERE payments.id = payment_events.payment_id 
    AND payments.user_id = auth.uid()
  )
);

CREATE POLICY "payment_events_service" ON payment_events
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Step 6: Helper functions
-- ============================================================================

-- Function to log payment event
CREATE OR REPLACE FUNCTION log_payment_event(
  p_payment_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO payment_events (payment_id, event_type, event_data, user_id)
  VALUES (p_payment_id, p_event_type, p_event_data, auth.uid())
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's default payment method
CREATE OR REPLACE FUNCTION get_default_payment_method(p_user_id UUID)
RETURNS user_payment_methods AS $$
  SELECT * FROM user_payment_methods
  WHERE user_id = p_user_id 
  AND is_default = true 
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Trigger to ensure only one default per provider
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE user_payment_methods
    SET is_default = false
    WHERE user_id = NEW.user_id 
    AND provider = NEW.provider
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_payment_methods_single_default
BEFORE INSERT OR UPDATE ON user_payment_methods
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_payment_method();

-- Trigger for updated_at
CREATE TRIGGER user_payment_methods_updated_at 
BEFORE UPDATE ON user_payment_methods
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at();

-- Step 7: Update payment status enum constraint
-- ============================================================================
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_status;
ALTER TABLE payments ADD CONSTRAINT valid_payment_status CHECK (status IN (
  'pending', 'processing', 'authorized', 'successful', 
  'failed', 'cancelled', 'refunded', 'expired', 'user_confirmed'
));

-- Step 8: Create views for easier querying
-- ============================================================================

CREATE OR REPLACE VIEW payment_summary AS
SELECT 
  p.*,
  o.order_number,
  o.restaurant_id,
  r.name as restaurant_name,
  COUNT(pe.id) as event_count,
  MAX(pe.created_at) as last_event_at
FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
LEFT JOIN restaurants r ON r.id = o.restaurant_id
LEFT JOIN payment_events pe ON pe.payment_id = p.id
GROUP BY p.id, o.order_number, o.restaurant_id, r.name;

GRANT SELECT ON payment_summary TO authenticated, service_role;

COMMIT;
