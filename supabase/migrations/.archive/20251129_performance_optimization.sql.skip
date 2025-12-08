-- Performance Optimization Migration
-- Based on load test results: LOAD_TEST_RESULTS.md
-- Expected impact: 40% latency reduction, 60% throughput increase

-- Part 1: Add indexes for most common queries
-- Issue: P99 latency exceeds 1 second due to missing indexes

BEGIN;

-- Index for voice_calls queries (most frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_created_at 
ON voice_calls(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_status 
ON voice_calls(status) 
WHERE status IN ('active', 'pending');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_phone 
ON voice_calls(to_number);

-- Index for whatsapp_messages (high traffic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_phone 
ON whatsapp_messages(from_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_created_at 
ON whatsapp_messages(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_status 
ON whatsapp_messages(status)
WHERE status != 'delivered';

-- Index for analytics queries (dashboard performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at 
ON transactions(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id 
ON transactions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status 
ON transactions(status)
WHERE status = 'pending';

-- Composite indexes for common join patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_user_created 
ON voice_calls(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_user_created 
ON whatsapp_messages(user_id, created_at DESC);

-- Part 2: Add partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_recent_active 
ON voice_calls(created_at DESC)
WHERE status = 'active' AND created_at > NOW() - INTERVAL '24 hours';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_recent_pending 
ON whatsapp_messages(created_at DESC)
WHERE status IN ('pending', 'failed') AND created_at > NOW() - INTERVAL '1 hour';

-- Part 3: Optimize frequently accessed tables
-- Add covering indexes to avoid table lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone_status 
ON users(phone_number, status, created_at)
WHERE status = 'active';

-- Part 4: Statistics update for query planner
ANALYZE voice_calls;
ANALYZE whatsapp_messages;
ANALYZE transactions;
ANALYZE users;

COMMIT;

-- Performance improvements summary:
-- - voice_calls queries: Expected 50-70% faster
-- - whatsapp_messages queries: Expected 40-60% faster
-- - Analytics queries: Expected 60-80% faster
-- - Dashboard loads: Expected 30-50% faster

-- Note: CONCURRENTLY allows index creation without blocking writes
-- Indexes will be used automatically by PostgreSQL query planner
