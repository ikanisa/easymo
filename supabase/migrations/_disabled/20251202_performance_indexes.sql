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
-- TRIPS TABLE (might be a view - skip index creation)
-- ============================================================================

-- Skip trips indexes - relation might be a view
-- Views don't support indexes
-- CREATE INDEX IF NOT EXISTS idx_trips_user_status 
--   ON trips(user_id, status);
-- CREATE INDEX IF NOT EXISTS idx_trips_role_status 
--   ON trips(role, status) 
--   WHERE status = 'open';
-- CREATE INDEX IF NOT EXISTS idx_trips_vehicle_status 
--   ON trips(vehicle_type, status);
-- CREATE INDEX IF NOT EXISTS idx_trips_created_at 
--   ON trips(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_trips_nearby_search 
--   ON trips(role, status, vehicle_type, created_at DESC)
--   WHERE status = 'open';

-- ============================================================================
-- USER_STATE TABLE (might not exist - skip)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_user_state_user 
--   ON user_state(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_state_expires 
--   ON user_state(expires_at)
--   WHERE expires_at IS NOT NULL;

-- ============================================================================
-- INSURANCE_LEADS TABLE (might not exist - skip)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_insurance_leads_whatsapp 
--   ON insurance_leads(whatsapp);
-- CREATE INDEX IF NOT EXISTS idx_insurance_leads_status 
--   ON insurance_leads(status);
-- CREATE INDEX IF NOT EXISTS idx_insurance_leads_created 
--   ON insurance_leads(created_at DESC);

-- ============================================================================
-- INSURANCE_CLAIMS TABLE (might not exist - skip)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_claims_whatsapp_status 
--   ON insurance_claims(whatsapp, status);
-- CREATE INDEX IF NOT EXISTS idx_claims_status 
--   ON insurance_claims(status);
-- CREATE INDEX IF NOT EXISTS idx_claims_submitted_at 
--   ON insurance_claims(submitted_at DESC);

-- ============================================================================
-- WALLET_TRANSACTIONS TABLE (might not exist)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created 
--   ON wallet_transactions(user_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_wallet_tx_status 
--   ON wallet_transactions(status);

-- ============================================================================
-- AUDIT_LOGS TABLE - indexes already exist
-- ============================================================================
-- (skipped - already created in previous migration)

-- ============================================================================
-- ANALYZE TABLES (skip if tables don't exist)
-- ============================================================================
-- ANALYZE profiles;
-- ANALYZE trips;
-- ANALYZE user_state;
-- ANALYZE insurance_leads;
-- ANALYZE insurance_claims;
-- ANALYZE wallet_transactions;

-- ============================================================================
-- COMMENTS (skip if indexes don't exist)
-- ============================================================================
-- COMMENT ON INDEX idx_trips_nearby_search IS 'Optimized for nearby driver/passenger searches';
-- COMMENT ON INDEX idx_profiles_whatsapp IS 'Primary lookup index for WhatsApp users';
