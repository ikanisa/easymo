-- ============================================================================
-- Migration: Delete Insurance and Rides AI Agents
-- 
-- Purpose: Remove insurance and rides AI agents from the database
-- These AI agents are being replaced with WhatsApp button-based workflows
-- 
-- After this migration, the system will have 7 production AI agents:
--   1. farmer
--   2. sales_cold_caller
--   3. jobs
--   4. waiter
--   5. real_estate
--   6. buy_and_sell
--   7. support
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Delete Insurance AI Agent and related records
-- ============================================================================

-- Delete tool associations for insurance agent
DELETE FROM ai_agent_tools 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete task associations for insurance agent
DELETE FROM ai_agent_tasks 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete persona associations for insurance agent
DELETE FROM ai_agent_personas 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete system instructions for insurance agent
DELETE FROM ai_agent_system_instructions 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete knowledge base associations for insurance agent (if exists)
DELETE FROM ai_agent_knowledge_bases 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete the insurance agent itself
DELETE FROM ai_agents WHERE slug = 'insurance';

-- ============================================================================
-- 2. Delete Rides AI Agent and related records
-- ============================================================================

-- Delete tool associations for rides agent
DELETE FROM ai_agent_tools 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete task associations for rides agent
DELETE FROM ai_agent_tasks 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete persona associations for rides agent
DELETE FROM ai_agent_personas 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete system instructions for rides agent
DELETE FROM ai_agent_system_instructions 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete knowledge base associations for rides agent (if exists)
DELETE FROM ai_agent_knowledge_bases 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete the rides agent itself
DELETE FROM ai_agents WHERE slug = 'rides';

-- ============================================================================
-- 3. Update home menu items to reflect WhatsApp workflow approach
-- ============================================================================

-- Update insurance menu item description (if exists)
UPDATE whatsapp_home_menu_items 
SET description = 'Get insurance quotes and manage policies via WhatsApp'
WHERE key IN ('insurance_agent', 'insurance');

-- Update rides/mobility menu item description (if exists)
UPDATE whatsapp_home_menu_items 
SET description = 'Find rides and drivers via WhatsApp'
WHERE key IN ('rides_agent', 'rides', 'mobility');

-- ============================================================================
-- 4. Log the changes for audit purposes (if audit log table exists)
-- ============================================================================

-- Insert audit log entry for insurance agent deletion
INSERT INTO system_audit_log (action, details, created_at)
SELECT 
  'DELETE_AI_AGENT',
  '{"slug": "insurance", "reason": "Replaced with WhatsApp button-based workflows"}'::jsonb,
  NOW()
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_audit_log');

-- Insert audit log entry for rides agent deletion
INSERT INTO system_audit_log (action, details, created_at)
SELECT 
  'DELETE_AI_AGENT',
  '{"slug": "rides", "reason": "Replaced with WhatsApp button-based workflows"}'::jsonb,
  NOW()
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_audit_log');

COMMIT;
