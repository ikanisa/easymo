-- Performance Optimization Indexes
-- Run this migration to add indexes for frequently queried columns

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- Primary lookup by phone number
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp 
  ON profiles(whatsapp_e164);

-- Language filtering
CREATE INDEX IF NOT EXISTS idx_profiles_language 
  ON profiles(language);

-- ============================================================================
-- TRIPS TABLE
-- ============================================================================

-- Active trips lookup
CREATE INDEX IF NOT EXISTS idx_trips_user_status 
  ON trips(user_id, status);

-- Driver availability (role + status)
CREATE INDEX IF NOT EXISTS idx_trips_role_status 
  ON trips(role, status) 
  WHERE status = 'open';

-- Vehicle type filtering
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_status 
  ON trips(vehicle_type, status);

-- Temporal queries
CREATE INDEX IF NOT EXISTS idx_trips_created_at 
  ON trips(created_at DESC);

-- Composite index for nearby search
CREATE INDEX IF NOT EXISTS idx_trips_nearby_search 
  ON trips(role, status, vehicle_type, created_at DESC)
  WHERE status = 'open';

-- ============================================================================
-- USER_STATE TABLE
-- ============================================================================

-- State lookup by user
CREATE INDEX IF NOT EXISTS idx_user_state_user 
  ON user_state(user_id);

-- Expiry cleanup
CREATE INDEX IF NOT EXISTS idx_user_state_expires 
  ON user_state(expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- INSURANCE_LEADS TABLE
-- ============================================================================

-- WhatsApp lookup
CREATE INDEX IF NOT EXISTS idx_insurance_leads_whatsapp 
  ON insurance_leads(whatsapp);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_insurance_leads_status 
  ON insurance_leads(status);

-- Temporal lookup
CREATE INDEX IF NOT EXISTS idx_insurance_leads_created 
  ON insurance_leads(created_at DESC);

-- ============================================================================
-- INSURANCE_CLAIMS TABLE
-- ============================================================================

-- User claims lookup
CREATE INDEX IF NOT EXISTS idx_claims_whatsapp_status 
  ON insurance_claims(whatsapp, status);

-- Status tracking
CREATE INDEX IF NOT EXISTS idx_claims_status 
  ON insurance_claims(status);

-- Temporal queries
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at 
  ON insurance_claims(submitted_at DESC);

-- ============================================================================
-- WALLET_TRANSACTIONS TABLE
-- ============================================================================

-- User transaction history
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created 
  ON wallet_transactions(user_id, created_at DESC);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status 
  ON wallet_transactions(status);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================

-- Temporal queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
  ON audit_logs(timestamp DESC);

-- User audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
  ON audit_logs(user_id);

-- Action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON audit_logs(action);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE profiles;
ANALYZE trips;
ANALYZE user_state;
ANALYZE insurance_leads;
ANALYZE insurance_claims;
ANALYZE wallet_transactions;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_trips_nearby_search IS 'Optimized for nearby driver/passenger searches';
COMMENT ON INDEX idx_profiles_whatsapp IS 'Primary lookup index for WhatsApp users';
