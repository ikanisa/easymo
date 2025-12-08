BEGIN;

-- Align menu item keys with their AI agent workflows
-- This ensures menu selections route to the correct AI agents

-- Most keys are already aligned correctly
-- Only update if needed

-- Update general_broker_agent to sales_agent for Help Center
UPDATE public.whatsapp_home_menu_items
SET key = 'sales_agent', updated_at = NOW()
WHERE key = 'general_broker_agent' AND is_active = true;

COMMIT;
