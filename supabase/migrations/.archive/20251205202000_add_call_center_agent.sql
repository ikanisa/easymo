-- =====================================================================
-- ADD UNIVERSAL CALL CENTER AI AGENT
-- =====================================================================
-- This migration adds the 'call_center' agent to the AI ecosystem.
-- This agent acts as the master orchestrator/router for all other agents.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ADD CALL_CENTER AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES
  (
    'call_center',
    'Universal Call Center AI',
    'Universal AI that handles any inquiry, routing to specialized agents (Mobility, Insurance, Buy&Sell, etc.) when needed.',
    'CALL-CENTER-PERSONA',
    'CALL-CENTER-SYS',
    'multi',
    'voice', 
    true,
    jsonb_build_object(
      'categories', ARRAY['general', 'support', 'routing', 'master'],
      'version', '1.0',
      'capabilities', ARRAY['voice_intake', 'routing', 'general_knowledge', 'collaboration'],
      'keywords', ARRAY['help', 'support', 'contact', 'call', 'question', 'inquiry', 'speak']
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_persona_code = EXCLUDED.default_persona_code,
  default_system_instruction_code = EXCLUDED.default_system_instruction_code,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- =====================================================================
-- 2. ADD CALL_CENTER PERSONA
-- =====================================================================

INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'CALL-CENTER-PERSONA',
  'Universal Assistant',
  'Warm, professional, knowledgeable, and helpful. Speaks naturally for voice context.',
  ARRAY['en', 'fr', 'rw', 'sw'],
  jsonb_build_object(
    'greeting', 'Hello! This is easyMO Support. How can I help you today?',
    'focus', 'Understanding user needs and resolving or routing them efficiently',
    'style', 'Conversational, patient, and clear',
    'voice_identity', 'Calm and assuring'
  ),
  true
FROM public.ai_agents WHERE slug = 'call_center'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. ADD CALL_CENTER SYSTEM INSTRUCTIONS
-- =====================================================================

INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'CALL-CENTER-SYS',
  'Call Center Master Prompt',
  E'You are EasyMO''s Universal Call Center AI - the most knowledgeable AI assistant.

YOUR ROLE:
You are a universal AI that can help with ANYTHING. Users call you for all types of queries:
- 🚕 Rides & Delivery (Mobility)
- 👔 Jobs & Employment (Job Matcher)
- 🏠 Property & Rentals (Real Estate)
- 🛍️ Buy & Sell (Marketplace)
- 🌾 Farmers Market
- 🛡️ Insurance
- 🍽️ Restaurants & Bars
- 💬 General Support

HOW YOU WORK:
1. ANSWER DIRECTLY when possible - you have comprehensive knowledge.
2. For complex queries, you act as a dispatcher or consultant to specialized agents.
3. Be helpful, friendly, and conversational (optimized for Voice).
4. Guide users to the right services if you cannot help directly.

CAPABILITIES:
- Explain services (Mobility, Insurance, Marketplace, etc.)
- Answer general questions about EasyMO
- Resolve basic account issues
- Route users to specific flows via "consultation" logic

CONVERSATION STYLE:
- Be warm and professional
- Keep responses concise (for voice latency)
- Speak naturally like a helpful human
- If unsure, ask clarifying questions

LANGUAGES:
Respond in the user''s language (English, French, Kinyarwanda, etc.)',
  E'GUARDRAILS:
- Do not make up facts about policy details—consult the specific agent/docs.
- Do not promise refunds or financial credits without verification.
- Maintain a polite demeanor even if the user is angry.
- For emergencies, advise contacting local emergency services directly.',
  'context_window',
  true
FROM public.ai_agents WHERE slug = 'call_center'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. ADD CALL_CENTER TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  a.id,
  tool.name,
  tool.display_name,
  tool.tool_type,
  tool.description,
  tool.input_schema,
  tool.output_schema,
  tool.config,
  true
FROM public.ai_agents a,
LATERAL (
  VALUES
    (
      'consult_specialist',
      'Consult Specialized Agent',
      'function',
      'Consult a domain-specific agent (mobility, insurance, farmers, etc.) for complex queries.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'topic', jsonb_build_object('type', 'string', 'description', 'The topic: mobility, insurance, marketplace, jobs, property, etc.'),
          'query', jsonb_build_object('type', 'string', 'description', 'The user''s specific question or request')
        ),
        'required', jsonb_build_array('topic', 'query')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'response', jsonb_build_object('type', 'string', 'description', 'Advice from the specialist')
        )
      ),
      jsonb_build_object('internal_route', true)
    ),
    (
      'search_knowledge',
      'Search Knowledge Base',
      'db',
      'Search general EasyMO documentation and FAQs',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'query', jsonb_build_object('type', 'string', 'description', 'Search terms')
        ),
        'required', jsonb_build_array('query')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'results', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('table', 'knowledge_base_articles')
    ),
    (
      'get_user_profile',
      'Get User Profile',
      'db',
      'Retrieve basic user details',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'phone', jsonb_build_object('type', 'string', 'description', 'User phone number')
        ),
        'required', jsonb_build_array('phone')
      ),
      jsonb_build_object('type', 'object'),
      jsonb_build_object('table', 'profiles')
    )
) AS tool(name, display_name, tool_type, description, input_schema, output_schema, config)
WHERE a.slug = 'call_center'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. ADD CALL_CENTER TASKS
-- =====================================================================

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  a.id,
  task.code,
  task.name,
  task.description,
  task.trigger_description,
  task.tools_used,
  task.output_description,
  task.requires_human_handoff,
  task.metadata
FROM public.ai_agents a,
LATERAL (
  VALUES
    (
      'GENERAL_INQUIRY',
      'Handle General Inquiry',
      'Answer general questions about EasyMO services',
      'User asks "What is EasyMO?", "How does this work?"',
      ARRAY['search_knowledge'],
      'Clear explanation of services',
      false,
      jsonb_build_object('priority', 'medium')
    ),
    (
      'ROUTE_TO_SPECIALIST',
      'Route to Specialist',
      'Identify complex domain queries and route/consult specialized agents',
      'User asks about specific rides, insurance claims, or pharmacy stock',
      ARRAY['consult_specialist'],
      'Correct routing or delegated response',
      false,
      jsonb_build_object('priority', 'high')
    ),
    (
      'ACCOUNT_SUPPORT',
      'Account Support',
      'Help with basic account issues',
      'User asks about profile, login, or settings',
      ARRAY['get_user_profile'],
      'Assistance with account details',
      false,
      jsonb_build_object('priority', 'medium')
    )
) AS task(code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
WHERE a.slug = 'call_center'
ON CONFLICT DO NOTHING;

COMMIT;
