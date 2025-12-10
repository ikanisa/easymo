-- Performance Index Optimization Migration
-- Based on audit findings for high-traffic query patterns

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- Index for filtering payments by SACCO and creation date (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_payments_sacco_created_at
ON public.payments (sacco_id, created_at DESC);

-- ============================================
-- SMS INBOX TABLE INDEXES
-- ============================================

-- Index for filtering SMS by parse source (AI vs REGEX analytics)
CREATE INDEX IF NOT EXISTS idx_sms_inbox_parse_source
ON public.sms_inbox (parse_source);

-- ============================================
-- ADDITIONAL INDEXES
-- ============================================

-- Ensure foreign keys are indexed for join performance
CREATE INDEX IF NOT EXISTS idx_users_sacco_id ON public.users(sacco_id);
CREATE INDEX IF NOT EXISTS idx_members_sacco_id ON public.members(sacco_id);
