-- Delete Rides AI Agent
-- Directive: Replace with WhatsApp workflows (button-based flows)
-- Mobility workflows remain in wa-webhook-mobility

BEGIN;

-- Delete agent tools
DELETE FROM ai_agent_tools 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete agent tasks
DELETE FROM ai_agent_tasks 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete agent personas
DELETE FROM ai_agent_personas 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete agent system instructions
DELETE FROM ai_agent_system_instructions 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete agent knowledge bases
DELETE FROM ai_agent_knowledge_bases 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

-- Delete the agent itself
DELETE FROM ai_agents WHERE slug = 'rides';

-- Update home menu to reflect workflow (not AI agent)
UPDATE whatsapp_home_menu_items 
SET description = 'Find rides and drivers via WhatsApp (button-based workflow)'
WHERE key = 'rides_agent' OR key = 'rides' OR key = 'mobility';

-- Add comment
COMMENT ON TABLE ai_agents IS 'AI Agents registry. Rides agent deleted 2025-12-10, replaced with workflows.';

COMMIT;
