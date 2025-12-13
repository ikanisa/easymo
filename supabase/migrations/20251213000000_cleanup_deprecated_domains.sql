-- EasyMO Refactoring: Remove deprecated domains
-- Date: 2025-12-13
-- Services removed: Jobs, Waiter, Farmer, Real Estate, Sales

BEGIN;

-- Clean AI agents table - keep only buy_and_sell
-- First, delete related records in dependent tables
DELETE FROM ai_agent_tools WHERE agent_id IN (
  SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
);

DELETE FROM ai_agent_personas WHERE agent_id IN (
  SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
);

DELETE FROM ai_agent_system_instructions WHERE agent_id IN (
  SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
);

-- Delete the agents themselves
DELETE FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell');

-- Update menu items to remove deleted services
-- Note: Keeping rides and insurance as they are now WhatsApp workflows
DELETE FROM menu_items WHERE slug IN ('jobs', 'waiter', 'farmer', 'real_estate', 'sales', 'property');

-- Archive old conversations from deleted agents if needed
-- (Optional: You may want to keep conversations for historical records)
-- UPDATE whatsapp_conversations 
-- SET status = 'archived'
-- WHERE agent_id IN (
--   SELECT id FROM ai_agents WHERE slug IN ('jobs', 'waiter', 'farmer', 'real_estate', 'sales', 'property')
-- );

COMMIT;
