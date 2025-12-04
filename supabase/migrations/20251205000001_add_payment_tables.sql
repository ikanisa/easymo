-- ============================================================================
-- ADD PAYMENT AND AUDIT TABLES
-- ============================================================================
-- Migration: 20251205000001_add_payment_tables.sql
-- Purpose: Create missing payment tracking and audit trail tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TRIP PAYMENT REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip reference
  trip_id uuid NOT NULL REFERENCES mobility_trip_matches(id) ON DELETE CASCADE,
  
  -- Payment parties
  payer_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  recipient_phone text NOT NULL,
  
  -- Payment details
  amount_rwf numeric(10,2) NOT NULL CHECK (amount_rwf > 0),
  currency text NOT NULL DEFAULT 'RWF',
  
  -- USSD/QR details
  ussd_code text NOT NULL,
  qr_url text,
  
  -- MTN MoMo API details (for automated verification)
  reference_id uuid, -- MTN MoMo transaction reference
  external_id text, -- Our internal reference
  
  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Payment initiated
    'successful',   -- Payment confirmed
    'failed',       -- Payment failed
    'expired',      -- Payment timeout
    'cancelled'     -- Payment cancelled
  )),
  
  -- Transaction details
  transaction_reference text, -- User-provided or API-returned reference (e.g., MP123456789)
  payment_method text DEFAULT 'mtn_momo',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  expires_at timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT unique_reference_per_trip UNIQUE (trip_id, transaction_reference)
);

COMMENT ON TABLE trip_payment_requests IS 'Tracks all payment requests for trips';
COMMENT ON COLUMN trip_payment_requests.reference_id IS 'MTN MoMo API transaction reference (UUID)';
COMMENT ON COLUMN trip_payment_requests.transaction_reference IS 'User-provided or API-returned reference (e.g., MP123456789)';

-- ============================================================================
-- 2. TRIP STATUS AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip reference
  trip_id uuid NOT NULL REFERENCES mobility_trip_matches(id) ON DELETE CASCADE,
  
  -- Status change
  old_status text,
  new_status text NOT NULL,
  
  -- Who changed it
  changed_by uuid REFERENCES profiles(user_id),
  changed_via text, -- 'user', 'system', 'admin', 'api'
  
  -- When
  changed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Additional context
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE trip_status_audit IS 'Audit trail for all trip status changes';
COMMENT ON COLUMN trip_status_audit.changed_via IS 'Source of change: user, system, admin, api';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Payment requests
CREATE INDEX IF NOT EXISTS idx_trip_payment_requests_trip 
  ON trip_payment_requests(trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_payment_requests_payer 
  ON trip_payment_requests(payer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_payment_requests_status 
  ON trip_payment_requests(status, created_at DESC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_trip_payment_requests_reference 
  ON trip_payment_requests(reference_id)
  WHERE reference_id IS NOT NULL;

-- Audit trail
CREATE INDEX IF NOT EXISTS idx_trip_status_audit_trip 
  ON trip_status_audit(trip_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_status_audit_changed_by 
  ON trip_status_audit(changed_by, changed_at DESC)
  WHERE changed_by IS NOT NULL;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Auto-update updated_at on payment requests
CREATE OR REPLACE FUNCTION mobility_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trip_payment_requests_updated_at ON trip_payment_requests;
CREATE TRIGGER trg_trip_payment_requests_updated_at
  BEFORE UPDATE ON trip_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_updated_at();

-- Auto-log status changes to audit table
CREATE OR REPLACE FUNCTION log_trip_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO trip_status_audit (
      trip_id,
      old_status,
      new_status,
      changed_via,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      'system',
      jsonb_build_object(
        'updated_at', NEW.updated_at,
        'version', NEW.version
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_trip_status_change ON mobility_trip_matches;
CREATE TRIGGER trg_log_trip_status_change
  AFTER UPDATE ON mobility_trip_matches
  FOR EACH ROW
  EXECUTE FUNCTION log_trip_status_change();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE trip_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_status_audit ENABLE ROW LEVEL SECURITY;

-- Payment requests: Users can view their own
DROP POLICY IF EXISTS "Users view own payment requests" ON trip_payment_requests;
CREATE POLICY "Users view own payment requests" 
  ON trip_payment_requests
  FOR SELECT 
  USING (auth.uid() = payer_id);

DROP POLICY IF EXISTS "Service role full access payment requests" ON trip_payment_requests;
CREATE POLICY "Service role full access payment requests" 
  ON trip_payment_requests
  FOR ALL 
  TO service_role 
  USING (true);

-- Audit trail: Users can view audits for their trips
DROP POLICY IF EXISTS "Users view own trip audits" ON trip_status_audit;
CREATE POLICY "Users view own trip audits" 
  ON trip_status_audit
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM mobility_trip_matches m
      WHERE m.id = trip_status_audit.trip_id
      AND (m.driver_user_id = auth.uid() OR m.passenger_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Service role full access trip audits" ON trip_status_audit;
CREATE POLICY "Service role full access trip audits" 
  ON trip_status_audit
  FOR ALL 
  TO service_role 
  USING (true);

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON trip_payment_requests TO authenticated;
GRANT SELECT ON trip_status_audit TO authenticated;

GRANT ALL ON trip_payment_requests TO service_role;
GRANT ALL ON trip_status_audit TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_payment_requests') THEN
    RAISE EXCEPTION 'trip_payment_requests table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_status_audit') THEN
    RAISE EXCEPTION 'trip_status_audit table not created';
  END IF;
  
  RAISE NOTICE 'Payment and audit tables created successfully';
END;
$$;
