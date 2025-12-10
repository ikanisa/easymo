-- Delete Insurance AI Agent
-- Directive: Replace with WhatsApp workflows (button-based flows)

BEGIN;

-- Delete agent tools
DELETE FROM ai_agent_tools 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete agent tasks
DELETE FROM ai_agent_tasks 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete agent personas
DELETE FROM ai_agent_personas 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete agent system instructions
DELETE FROM ai_agent_system_instructions 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete agent knowledge bases
DELETE FROM ai_agent_knowledge_bases 
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'insurance');

-- Delete the agent itself
DELETE FROM ai_agents WHERE slug = 'insurance';

-- Update home menu to reflect workflow (not AI agent)
UPDATE whatsapp_home_menu_items 
SET description = 'Get insurance quotes and manage policies via WhatsApp (button-based workflow)'
WHERE key = 'insurance_agent' OR key = 'insurance';

-- Log the deletion
INSERT INTO system_audit_log (action, details, created_at)
VALUES (
  'DELETE_AI_AGENT', 
  '{"slug": "insurance", "reason": "Replaced with WhatsApp button workflows per directive", "date": "2025-12-10"}',
  NOW()
);

-- Add comment
COMMENT ON TABLE ai_agents IS 'AI Agents registry. Insurance agent deleted 2025-12-10, replaced with workflows.';

COMMIT;
