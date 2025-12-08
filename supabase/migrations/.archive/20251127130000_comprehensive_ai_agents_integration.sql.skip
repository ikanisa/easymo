-- =====================================================================
-- COMPREHENSIVE AI AGENTS INTEGRATION
-- =====================================================================
-- This migration creates a dedicated Support Agent and ensures all AI
-- agents are properly linked with their personas, system instructions,
-- tools, tasks, intents, and knowledge bases.
--
-- Key Changes:
-- 1. Create dedicated Support Agent (separate from Sales)
-- 2. Update menu aliases to route support to support_agent
-- 3. Link all existing configurations to respective agents
-- 4. Create comprehensive agent configs for all agents
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE SUPPORT AGENT (DEDICATED)
-- =====================================================================

INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  is_active,
  config
) VALUES (
  'support',
  'Support Agent',
  'Customer support, navigation help, and platform assistance via WhatsApp, SMS, and Voice',
  true,
  jsonb_build_object(
    'capabilities', ARRAY['customer_support', 'navigation', 'troubleshooting', 'ticket_creation'],
    'categories', ARRAY['support', 'help', 'navigation', 'customer_service'],
    'channels', ARRAY['whatsapp', 'sms', 'voice'],
    'priority', 'high'
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  config = EXCLUDED.config;

-- =====================================================================
-- 2. CREATE SUPPORT AGENT PERSONA
-- =====================================================================

WITH agent AS (
  SELECT id FROM public.ai_agents WHERE slug = 'support'
)
INSERT INTO public.ai_agent_personas (
  agent_id,
  code,
  name,
  description,
  tone,
  response_style,
  personality_traits,
  cultural_adaptations,
  emoji_usage,
  is_active
) SELECT
  agent.id,
  'SUP-MAIN',
  'Helpful Support Representative',
  'Empathetic, patient customer support specialist who resolves issues quickly',
  'friendly',
  'Clear, step-by-step guidance with empathy',
  ARRAY['patient', 'empathetic', 'solution-oriented', 'calm', 'professional'],
  jsonb_build_object(
    'RW', jsonb_build_object('greeting', 'Mwaramutse! 👋 How can I help you today?'),
    'UG', jsonb_build_object('greeting', 'Hello! 👋 I''m here to help!'),
    'KE', jsonb_build_object('greeting', 'Jambo! 👋 How may I assist you?'),
    'TZ', jsonb_build_object('greeting', 'Habari! 👋 Naweza kukusaidia?')
  ),
  jsonb_build_object(
    'frequency', 'moderate',
    'types', ARRAY['😊', '✅', '🔧', '📞', '💡', '⚠️'],
    'guidelines', 'Use emojis to show empathy and clarify status'
  ),
  true
FROM agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tone = EXCLUDED.tone,
  response_style = EXCLUDED.response_style,
  personality_traits = EXCLUDED.personality_traits,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 3. CREATE SUPPORT AGENT SYSTEM INSTRUCTIONS
-- =====================================================================

WITH agent AS (
  SELECT id FROM public.ai_agents WHERE slug = 'support'
)
INSERT INTO public.ai_agent_system_instructions (
  agent_id,
  code,
  category,
  priority,
  instruction_text,
  applies_to_countries,
  is_active
) SELECT
  agent.id,
  'SUP-CORE',
  'core_behavior',
  1,
  E'# Support Agent Core Instructions

You are EasyMO''s Customer Support Agent. Your role is to:

## 1. PRIMARY RESPONSIBILITIES
- Help users navigate the platform and find services
- Troubleshoot common issues (login, payments, bookings)
- Create support tickets for complex issues
- Guide users to the right AI agent for their needs

## 2. CONVERSATION APPROACH
- Start with empathy: Acknowledge the user''s concern
- Ask clarifying questions to understand the issue
- Provide step-by-step solutions
- Follow up to ensure the issue is resolved
- Use simple, clear language

## 3. COMMON ISSUES & SOLUTIONS

### Login Problems
1. Verify phone number is correct
2. Check network connectivity
3. Clear WhatsApp cache
4. Escalate to support ticket if issue persists

### Payment Issues
1. Confirm MoMo account is active
2. Check available balance
3. Verify transaction ID
4. Create support ticket for failed payments

### Booking Issues
1. Verify service availability
2. Check location settings
3. Confirm time slots
4. Assist with rebooking if needed

## 4. ESCALATION CRITERIA
Create support tickets for:
- Payment failures or refund requests
- Account access issues after basic troubleshooting
- Service quality complaints
- Technical errors or bugs
- Issues requiring human review

## 5. INTERACTION EXAMPLES

User: "I can''t log in!"
You: "I understand how frustrating that is. 😊 Let me help you fix this. First, are you using the same phone number you registered with?"

User: "My payment failed but money was deducted"
You: "I''m sorry to hear that! 💳 Payment issues need immediate attention. Let me create a support ticket for our finance team. I''ll need your transaction ID and the amount deducted."

## 6. BOUNDARIES
- Only access user data when necessary for support
- Maintain confidentiality
- Stay focused on EasyMO platform support
- Don''t make promises you can''t keep
- Escalate when uncertain

## 7. METRICS TO TRACK
- Log all support interactions
- Record ticket creation
- Track resolution time
- Monitor user satisfaction',
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD', 'SS'],
  true
FROM agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  instruction_text = EXCLUDED.instruction_text,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 4. CREATE SUPPORT AGENT TOOLS
-- =====================================================================

WITH agent AS (
  SELECT id FROM public.ai_agents WHERE slug = 'support'
)
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  description,
  input_schema,
  implementation_status,
  is_active
) SELECT
  agent.id,
  tool.name,
  tool.description,
  tool.input_schema,
  'implemented',
  true
FROM agent,
LATERAL (VALUES
  (
    'get_user_profile',
    'Retrieve user profile to assist with account issues',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'phone_number', jsonb_build_object('type', 'string', 'description', 'User phone number in E.164 format')
      ),
      'required', jsonb_build_array('phone_number')
    )
  ),
  (
    'create_support_ticket',
    'Escalate complex issues to human support team',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'user_id', jsonb_build_object('type', 'string', 'description', 'User ID'),
        'category', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('payment', 'login', 'booking', 'technical', 'other')),
        'priority', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('low', 'medium', 'high', 'urgent')),
        'subject', jsonb_build_object('type', 'string', 'description', 'Brief issue summary'),
        'description', jsonb_build_object('type', 'string', 'description', 'Detailed issue description'),
        'metadata', jsonb_build_object('type', 'object', 'description', 'Additional context')
      ),
      'required', jsonb_build_array('user_id', 'category', 'priority', 'subject', 'description')
    )
  ),
  (
    'search_faq',
    'Search knowledge base for answers to common questions',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'query', jsonb_build_object('type', 'string', 'description', 'User question or keywords')
      ),
      'required', jsonb_build_array('query')
    )
  ),
  (
    'check_service_status',
    'Check if a specific EasyMO service is operational',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'service', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('rides', 'jobs', 'property', 'waiter', 'marketplace', 'payments'))
      ),
      'required', jsonb_build_array('service')
    )
  )
) AS tool(name, description, input_schema)
ON CONFLICT (agent_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 5. CREATE SUPPORT AGENT TASKS
-- =====================================================================

WITH agent AS (
  SELECT id FROM public.ai_agents WHERE slug = 'support'
)
INSERT INTO public.ai_agent_tasks (
  agent_id,
  task_name,
  task_description,
  trigger_conditions,
  required_tools,
  expected_tools,
  workflow_steps,
  success_criteria,
  is_active
) SELECT
  agent.id,
  task.name,
  task.description,
  task.triggers,
  task.required_tools,
  task.expected_tools,
  task.steps,
  task.success,
  true
FROM agent,
LATERAL (VALUES
  (
    'troubleshoot_login',
    'Help user resolve login issues',
    jsonb_build_array('user mentions login problem', 'user can''t access account'),
    ARRAY['get_user_profile'],
    ARRAY['get_user_profile', 'create_support_ticket'],
    jsonb_build_array(
      'Acknowledge the issue with empathy',
      'Verify user phone number',
      'Guide through basic troubleshooting steps',
      'Create support ticket if unresolved'
    ),
    'User can log in OR support ticket created'
  ),
  (
    'resolve_payment_issue',
    'Handle payment failures and refund requests',
    jsonb_build_array('payment failed', 'refund request', 'money deducted'),
    ARRAY['create_support_ticket'],
    ARRAY['get_user_profile', 'create_support_ticket'],
    jsonb_build_array(
      'Express empathy and urgency',
      'Collect transaction details',
      'Create high-priority support ticket',
      'Provide ticket reference number',
      'Set expectation for resolution time'
    ),
    'Support ticket created with all transaction details'
  ),
  (
    'guide_navigation',
    'Help user find and navigate to correct service',
    jsonb_build_array('user is lost', 'how do I', 'where is'),
    ARRAY['search_faq'],
    ARRAY['search_faq', 'check_service_status'],
    jsonb_build_array(
      'Understand what user is trying to do',
      'Search FAQ for relevant guidance',
      'Provide clear navigation steps',
      'Offer to direct them to appropriate AI agent'
    ),
    'User knows how to proceed to their desired service'
  )
) AS task(name, description, triggers, required_tools, expected_tools, steps, success)
ON CONFLICT (agent_id, task_name) DO UPDATE SET
  task_description = EXCLUDED.task_description,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 6. CREATE SUPPORT AGENT INTENTS
-- =====================================================================

WITH agent AS (
  SELECT id FROM public.ai_agents WHERE slug = 'support'
)
INSERT INTO public.ai_agent_intents (
  agent_id,
  intent_name,
  description,
  example_utterances,
  required_entities,
  confidence_threshold,
  is_active
) SELECT
  agent.id,
  intent.name,
  intent.description,
  intent.examples,
  intent.entities,
  0.7,
  true
FROM agent,
LATERAL (VALUES
  (
    'request_help',
    'User needs general help or support',
    ARRAY['help', 'I need help', 'assist me', 'support', 'customer service'],
    ARRAY[]::text[]
  ),
  (
    'report_login_issue',
    'User cannot log in or access account',
    ARRAY['can''t log in', 'login not working', 'can''t access account', 'password not working'],
    ARRAY['phone_number']
  ),
  (
    'report_payment_issue',
    'User has payment or transaction problem',
    ARRAY['payment failed', 'money deducted', 'refund', 'transaction error', 'payment not working'],
    ARRAY['transaction_id', 'amount']
  ),
  (
    'ask_how_to',
    'User asking how to do something',
    ARRAY['how do I', 'how can I', 'how to', 'what is the process'],
    ARRAY[]::text[]
  ),
  (
    'check_status',
    'User checking status of service or request',
    ARRAY['is it working', 'status', 'is the service down', 'when will it be fixed'],
    ARRAY['service_name']
  )
) AS intent(name, description, examples, entities)
ON CONFLICT (agent_id, intent_name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 7. UPDATE WHATSAPP HOME MENU - ADD SUPPORT ITEM
-- =====================================================================

INSERT INTO public.whatsapp_home_menu_items (
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  country_specific_names
) VALUES (
  'support_agent',
  '🆘 Support & Help',
  '🆘',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD', 'SS'],
  10,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '🆘 Ubufasha', 'description', 'Hamagara umutekinisiye wacu'),
    'UG', jsonb_build_object('name', '🆘 Support & Help', 'description', 'Get assistance from our team'),
    'KE', jsonb_build_object('name', '🆘 Support & Help', 'description', 'Get assistance from our team'),
    'TZ', jsonb_build_object('name', '🆘 Msaada', 'description', 'Pata msaada kutoka kwa timu yetu')
  )
) ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- =====================================================================
-- 8. LINK ALL EXISTING AGENT CONFIGURATIONS
-- =====================================================================

-- This ensures any existing personas, instructions, tools, etc. that
-- weren't properly linked get connected to their agents

-- Waiter Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE (code LIKE 'W-%' OR code LIKE 'waiter%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE (code LIKE 'W-%' OR code LIKE 'waiter%') AND agent_id IS NULL;

-- Rides Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE (code LIKE 'R-%' OR code LIKE 'rides%' OR code LIKE 'mobility%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE (code LIKE 'R-%' OR code LIKE 'rides%' OR code LIKE 'mobility%') AND agent_id IS NULL;

-- Jobs Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE (code LIKE 'J-%' OR code LIKE 'jobs%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE (code LIKE 'J-%' OR code LIKE 'jobs%') AND agent_id IS NULL;

-- Business Broker Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE (code LIKE 'BB-%' OR code LIKE 'broker%' OR code LIKE 'business_broker%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE (code LIKE 'BB-%' OR code LIKE 'broker%' OR code LIKE 'business_broker%') AND agent_id IS NULL;

-- Real Estate Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE (code LIKE 'RE-%' OR code LIKE 'real_estate%' OR code LIKE 'property%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE (code LIKE 'RE-%' OR code LIKE 'real_estate%' OR code LIKE 'property%') AND agent_id IS NULL;

-- Farmer Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE (code LIKE 'F-%' OR code LIKE 'farmer%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE (code LIKE 'F-%' OR code LIKE 'farmer%') AND agent_id IS NULL;

-- Insurance Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE (code LIKE 'INS-%' OR code LIKE 'insurance%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE (code LIKE 'INS-%' OR code LIKE 'insurance%') AND agent_id IS NULL;

-- Sales Agent
UPDATE public.ai_agent_personas SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE (code LIKE 'SDR-%' OR code LIKE 'sales%') AND agent_id IS NULL;

UPDATE public.ai_agent_system_instructions SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE (code LIKE 'SDR-%' OR code LIKE 'sales%') AND agent_id IS NULL;

-- =====================================================================
-- 9. CREATE AI AGENT CONFIGS FOR ALL ACTIVE AGENTS
-- =====================================================================

-- This creates comprehensive configs linking each agent with all their
-- personas, instructions, tools, tasks, intents, and knowledge bases

INSERT INTO public.ai_agent_configs (
  agent_id,
  persona_id,
  system_instruction_ids,
  tool_ids,
  task_ids,
  intent_ids,
  knowledge_base_ids,
  is_active
)
SELECT
  a.id as agent_id,
  (SELECT id FROM public.ai_agent_personas WHERE agent_id = a.id AND is_active = true LIMIT 1) as persona_id,
  COALESCE((SELECT array_agg(id) FROM public.ai_agent_system_instructions WHERE agent_id = a.id AND is_active = true), ARRAY[]::uuid[]) as system_instruction_ids,
  COALESCE((SELECT array_agg(id) FROM public.ai_agent_tools WHERE agent_id = a.id AND is_active = true), ARRAY[]::uuid[]) as tool_ids,
  COALESCE((SELECT array_agg(id) FROM public.ai_agent_tasks WHERE agent_id = a.id AND is_active = true), ARRAY[]::uuid[]) as task_ids,
  COALESCE((SELECT array_agg(id) FROM public.ai_agent_intents WHERE agent_id = a.id AND is_active = true), ARRAY[]::uuid[]) as intent_ids,
  COALESCE((SELECT array_agg(id) FROM public.ai_agent_knowledge_bases WHERE agent_id = a.id AND is_active = true), ARRAY[]::uuid[]) as knowledge_base_ids,
  true
FROM public.ai_agents a
WHERE a.is_active = true
ON CONFLICT (agent_id)
DO UPDATE SET
  persona_id = EXCLUDED.persona_id,
  system_instruction_ids = EXCLUDED.system_instruction_ids,
  tool_ids = EXCLUDED.tool_ids,
  task_ids = EXCLUDED.task_ids,
  intent_ids = EXCLUDED.intent_ids,
  knowledge_base_ids = EXCLUDED.knowledge_base_ids,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
