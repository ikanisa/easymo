BEGIN;

-- =====================================================
-- ADD COMPOSITE INDEXES FOR PERFORMANCE
-- =====================================================
-- Addresses P2 issue: Missing composite indexes on frequently queried columns
-- These indexes improve query performance for common patterns
-- =====================================================

-- Composite index for wa_events table (user messages over time)
-- Common query pattern: SELECT * FROM wa_events WHERE wa_id = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_events_wa_id_created_at 
  ON public.wa_events(wa_id, created_at DESC);

-- Composite index for insurance_leads table (active leads by user)
-- Common query pattern: SELECT * FROM insurance_leads WHERE whatsapp = ? AND status IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_leads_whatsapp_status_created 
  ON public.insurance_leads(whatsapp, status, created_at DESC)
  WHERE status IN ('received', 'processing');

-- Additional composite index for wa_events (filtered by message type)
-- Improves queries that filter by event type and user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_events_wa_id_event_type_created 
  ON public.wa_events(wa_id, event_type, created_at DESC)
  WHERE event_type = 'message';

-- Composite index for insurance_leads (user lookup with recent first)
-- Optimizes admin dashboard queries for recent leads
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_leads_status_created 
  ON public.insurance_leads(status, created_at DESC)
  WHERE status IN ('received', 'processing', 'pending');

-- Comments
COMMENT ON INDEX idx_wa_events_wa_id_created_at IS 'Composite index for user message history queries';
COMMENT ON INDEX idx_insurance_leads_whatsapp_status_created IS 'Composite index for active insurance leads by user';
COMMENT ON INDEX idx_wa_events_wa_id_event_type_created IS 'Composite index for filtered message type queries';
COMMENT ON INDEX idx_insurance_leads_status_created IS 'Composite index for admin dashboard recent leads';

COMMIT;
