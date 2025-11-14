-- Performance optimization indexes for high-traffic queries
-- Addresses findings from comprehensive platform review

BEGIN;

-- =============================================================================
-- TRANSACTIONS TABLE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(profile_id, occurred_at DESC)
  WHERE profile_id IS NOT NULL;

-- Index for transaction status queries (wallet_transactions uses direction field)
-- Commented out as wallet_transactions does not have a status field
-- CREATE INDEX IF NOT EXISTS idx_transactions_status_created
--   ON public.wallet_transactions(direction, occurred_at DESC);

-- Index for amount range queries (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_transactions_amount
  ON public.wallet_transactions(amount_minor)
  WHERE profile_id IS NOT NULL;

-- =============================================================================
-- MESSAGES TABLE INDEXES
-- =============================================================================

-- Composite index for conversation message queries (critical for chat performance)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp
  ON messages(conversation_id, timestamp DESC);

-- Index for message status tracking
CREATE INDEX IF NOT EXISTS idx_messages_status
  ON messages(status, timestamp DESC)
  WHERE status IN ('pending', 'failed');

-- Index for user message lookups
CREATE INDEX IF NOT EXISTS idx_messages_user_timestamp
  ON messages(user_id, timestamp DESC);

-- =============================================================================
-- AGENTS/DRIVERS TABLE INDEXES
-- =============================================================================

-- Geohash index for location-based queries (nearby drivers)
-- Using btree for geohash prefix matching
CREATE INDEX IF NOT EXISTS idx_drivers_location_geohash
  ON drivers(location_geohash)
  WHERE status = 'available';

-- Index for driver availability queries
CREATE INDEX IF NOT EXISTS idx_drivers_available_updated
  ON drivers(status, updated_at DESC)
  WHERE status IN ('available', 'busy');

-- Composite index for driver assignment queries
CREATE INDEX IF NOT EXISTS idx_drivers_status_location
  ON drivers(status, last_location)
  WHERE status = 'available' AND last_location IS NOT NULL;

-- =============================================================================
-- TRIPS TABLE INDEXES
-- =============================================================================

-- Index for active trip queries
CREATE INDEX IF NOT EXISTS idx_trips_status_created
  ON trips(status, created_at DESC);

-- Index for passenger trip history
CREATE INDEX IF NOT EXISTS idx_trips_passenger_created
  ON trips(passenger_id, created_at DESC)
  WHERE passenger_id IS NOT NULL;

-- Index for driver trip history
CREATE INDEX IF NOT EXISTS idx_trips_driver_created
  ON trips(driver_id, created_at DESC)
  WHERE driver_id IS NOT NULL;

-- Index for trip completion queries
CREATE INDEX IF NOT EXISTS idx_trips_completed_at
  ON trips(completed_at DESC)
  WHERE status = 'completed' AND completed_at IS NOT NULL;

-- =============================================================================
-- SUBSCRIPTIONS TABLE INDEXES
-- =============================================================================

-- Index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires
  ON subscriptions(status, expires_at DESC);

-- Index for user subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions(user_id, status, expires_at DESC)
  WHERE status = 'active';

-- =============================================================================
-- CONVERSATION STATE TABLE INDEXES
-- =============================================================================

-- Index for active conversation state queries
CREATE INDEX IF NOT EXISTS idx_conversation_state_user_updated
  ON conversation_state(user_id, updated_at DESC)
  WHERE status = 'active';

-- Index for conversation timeout queries
CREATE INDEX IF NOT EXISTS idx_conversation_state_timeout
  ON conversation_state(updated_at)
  WHERE status = 'active';

-- =============================================================================
-- WALLET TABLES INDEXES (if exist)
-- =============================================================================

-- Index for wallet transaction history
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_profile_occurred
  ON wallet_transactions(profile_id, occurred_at DESC)
  WHERE profile_id IS NOT NULL;

-- Index for wallet transactions by direction (credit/debit)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_direction
  ON wallet_transactions(direction, occurred_at DESC)
  WHERE direction IS NOT NULL;

-- =============================================================================
-- AUDIT LOG INDEXES
-- =============================================================================

-- Index for audit log queries by table and user
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created
  ON audit_log(table_name, created_at DESC)
  WHERE table_name IS NOT NULL;

-- Index for user action audits
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- CLEANUP & OPTIMIZATION
-- =============================================================================

-- Analyze tables to update statistics for query planner
-- ANALYZE public.wallet_transactions;  -- Commented as table doesn't have enough records yet
ANALYZE messages;
ANALYZE drivers;
ANALYZE trips;
ANALYZE subscriptions;

COMMIT;

-- Note: CONCURRENTLY indexes cannot be created within a transaction block.
-- If this migration fails due to lock contention, consider running problematic
-- CREATE INDEX statements with CONCURRENTLY outside of BEGIN/COMMIT.
-- See: https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY
