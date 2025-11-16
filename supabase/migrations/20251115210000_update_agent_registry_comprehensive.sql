-- =====================================================
-- UPDATE AGENT REGISTRY - COMPREHENSIVE
-- =====================================================
-- Updates agent configurations to match actual schema
-- Only uses existing columns in agent_configs table
-- =====================================================

BEGIN;

-- Note: Agent configs are managed dynamically via agent_registry table
-- This migration is intentionally minimal to avoid schema conflicts
-- Actual agent instructions, persona, and tools are loaded from agent_registry

-- Ensure job-board agent exists (created in earlier migration)
-- No additional static agent configs needed - they should be managed dynamically

COMMIT;
