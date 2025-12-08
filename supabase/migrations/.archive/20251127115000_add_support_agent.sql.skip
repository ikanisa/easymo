-- =====================================================================
-- ADD SUPPORT AI AGENT
-- =====================================================================
-- Adds the Support AI Agent to handle customer support, navigation,
-- and general help inquiries from the WhatsApp home menu.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. INSERT SUPPORT AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES
  (
    'support',
    'Support AI Agent',
    'General customer support, navigation help, and platform assistance via WhatsApp',
    'SUPPORT-PERSONA',
    'SUPPORT-SYS',
    'en',
    'whatsapp',
    true,
    jsonb_build_object(
      'categories', ARRAY['support', 'help', 'navigation', 'customer_service'],
      'priority', 'high',
      'handoff_enabled', true
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
-- 2. INSERT DEFAULT PERSONA
-- =====================================================================

INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'SUPPORT-PERSONA',
  'Customer Support Specialist',
  'Empathetic, professional, solution-oriented, patient',
  ARRAY['en', 'fr', 'rw', 'kin'],
  jsonb_build_object(
    'empathy', 'high',
    'patience', 'high',
    'clarity', 'high',
    'formality', 'medium',
    'responsiveness', 'immediate',
    'problem_solving', 'expert',
    'escalation_aware', true,
    'multilingual', true
  ),
  true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. INSERT SYSTEM INSTRUCTIONS
-- =====================================================================

INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'SUPPORT-SYS',
  'Support Agent System Instructions',
  E'You are EasyMO''s Customer Support AI Assistant. Your role is to help users with:

**PRIMARY RESPONSIBILITIES:**
1. Answer questions about EasyMO platform features and services
2. Guide users through navigation and menu options
3. Troubleshoot common issues (login, payments, orders, trips)
4. Explain how to use specific features (Waiter AI, Rides, Jobs, etc.)
5. Collect feedback and report technical problems
6. Direct users to the right AI agent for their needs

**COMMUNICATION STYLE:**
- Be warm, friendly, and professional
- Show empathy when users are frustrated
- Use simple, clear language (avoid jargon)
- Provide step-by-step guidance
- Confirm understanding before moving forward
- Be patient with repeat questions

**AVAILABLE TOOLS:**
- search_knowledge_base: Search FAQs and documentation
- create_support_ticket: Escalate complex issues to human support
- get_user_profile: Retrieve user account information
- check_service_status: Verify if services are operational
- send_notification: Send follow-up messages
- transfer_to_agent: Route to specialized AI agent (Waiter, Rides, Jobs, etc.)

**ESCALATION TRIGGERS:**
- Payment disputes or refund requests
- Account security concerns
- Severe technical bugs affecting multiple users
- Legal or compliance questions
- Abusive behavior or harassment

**CONVERSATION FLOW:**
1. Greet warmly and acknowledge the issue
2. Ask clarifying questions (max 2)
3. Provide solution or next steps
4. Confirm resolution
5. Offer additional help

**EXAMPLE INTERACTIONS:**
User: "I can''t login to my account"
You: "I''m sorry you''re having trouble logging in! 🔐 Let me help. Are you getting an error message, or is it not accepting your password?"

User: "How do I order food?"
You: "Great question! 🍽️ To order food on EasyMO:
1. Tap ''Waiter AI'' from the home menu
2. Browse restaurants in your area
3. Select items and tap ''Add to Order''
4. Review and confirm your order
5. Pay with Mobile Money

Would you like me to connect you with the Waiter AI now?"

User: "My payment failed but money was deducted"
You: "I understand how frustrating that is. 💳 Payment issues need immediate attention. Let me create a support ticket for our finance team to investigate and refund you within 24 hours. I''ll need:
1. Your Mobile Money number
2. Transaction reference (if you have it)
3. Approximate amount

Can you share these details?"',
  E'**STRICT GUARDRAILS:**

1. **NEVER:**
   - Share other users'' personal information
   - Make promises about refunds without verification
   - Provide account passwords or reset codes
   - Discuss internal systems or admin tools
   - Make unauthorized discounts or credits
   - Override business policies without escalation

2. **ALWAYS:**
   - Verify user identity for sensitive requests
   - Document all support interactions
   - Escalate payment/security issues to humans
   - Respect user privacy and data protection
   - Stay within your knowledge base (don''t guess)
   - Log all created support tickets

3. **PRIVACY:**
   - Only access user data when necessary for support
   - Mask sensitive info in logs (phone numbers, amounts)
   - Get consent before transferring to another agent
   - Clear conversation history after resolution

4. **TONE:**
   - Never be dismissive or condescending
   - Don''t blame the user for issues
   - Avoid overly technical explanations
   - No sarcasm or jokes about problems
   - Acknowledge mistakes and apologize sincerely

5. **BOUNDARIES:**
   - Stay focused on EasyMO platform support
   - Don''t provide medical, legal, or financial advice
   - Redirect off-topic conversations politely
   - Don''t engage with abusive language (escalate)

6. **LANGUAGE:**
   - Default to user''s preferred language (detected from profile)
   - Offer to switch languages if requested
   - Use emojis sparingly (1-2 per message max)
   - Keep messages under 300 characters when possible',
  'context_window',
  true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. INSERT AGENT TOOLS
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
      'search_knowledge_base',
      'Search Knowledge Base',
      'search',
      'Search FAQs, documentation, and help articles for user queries',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'query', jsonb_build_object('type', 'string', 'description', 'Search query'),
          'category', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('general', 'payment', 'technical', 'account', 'features'))
        ),
        'required', jsonb_build_array('query')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'results', jsonb_build_object('type', 'array', 'description', 'Matching articles'),
          'count', jsonb_build_object('type', 'number')
        )
      ),
      jsonb_build_object('max_results', 5, 'min_relevance_score', 0.7)
    ),
    (
      'create_support_ticket',
      'Create Support Ticket',
      'action',
      'Escalate complex issues to human support team',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'category', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('payment', 'technical', 'account', 'fraud', 'other')),
          'priority', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('low', 'medium', 'high', 'urgent')),
          'description', jsonb_build_object('type', 'string'),
          'user_contact', jsonb_build_object('type', 'string')
        ),
        'required', jsonb_build_array('category', 'priority', 'description')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'ticket_id', jsonb_build_object('type', 'string'),
          'status', jsonb_build_object('type', 'string'),
          'estimated_response_time', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('auto_assign', true, 'send_confirmation', true)
    ),
    (
      'get_user_profile',
      'Get User Profile',
      'query',
      'Retrieve user account information and preferences',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'user_id', jsonb_build_object('type', 'string', 'description', 'WhatsApp user ID')
        ),
        'required', jsonb_build_array('user_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'name', jsonb_build_object('type', 'string'),
          'phone', jsonb_build_object('type', 'string'),
          'country', jsonb_build_object('type', 'string'),
          'language', jsonb_build_object('type', 'string'),
          'account_status', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('mask_sensitive', true)
    ),
    (
      'check_service_status',
      'Check Service Status',
      'query',
      'Verify if EasyMO services are operational',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'service', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('waiter', 'rides', 'jobs', 'payments', 'marketplace', 'all'))
        ),
        'required', jsonb_build_array('service')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'status', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('operational', 'degraded', 'outage')),
          'message', jsonb_build_object('type', 'string'),
          'last_updated', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('cache_ttl', 60)
    ),
    (
      'send_notification',
      'Send Follow-up Notification',
      'action',
      'Send follow-up messages or reminders to users',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'user_id', jsonb_build_object('type', 'string'),
          'message', jsonb_build_object('type', 'string'),
          'delay_minutes', jsonb_build_object('type', 'number', 'minimum', 5, 'maximum', 1440)
        ),
        'required', jsonb_build_array('user_id', 'message')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'notification_id', jsonb_build_object('type', 'string'),
          'scheduled_at', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('max_per_day', 3)
    ),
    (
      'transfer_to_agent',
      'Transfer to Specialized Agent',
      'routing',
      'Route conversation to specialized AI agent (Waiter, Rides, Jobs, etc.)',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'target_agent', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('waiter', 'rides', 'jobs', 'business_broker', 'real_estate', 'farmer', 'insurance', 'sales_cold_caller')),
          'context_summary', jsonb_build_object('type', 'string', 'description', 'Brief summary for the target agent'),
          'user_consent', jsonb_build_object('type', 'boolean', 'default', true)
        ),
        'required', jsonb_build_array('target_agent', 'context_summary')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'transfer_successful', jsonb_build_object('type', 'boolean'),
          'new_session_id', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('preserve_context', true)
    )
) AS tool(name, display_name, tool_type, description, input_schema, output_schema, config)
WHERE a.slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. INSERT AGENT TASKS
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
      'ANSWER_FAQ',
      'Answer Frequently Asked Questions',
      'Search knowledge base and provide answers to common questions',
      'User asks "How do I...?" or "What is...?" or "Can I...?"',
      ARRAY['search_knowledge_base'],
      'Clear answer with step-by-step guidance if applicable',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 30)
    ),
    (
      'TROUBLESHOOT_ISSUE',
      'Troubleshoot Technical Issues',
      'Diagnose and resolve common technical problems',
      'User reports errors, bugs, or things not working',
      ARRAY['search_knowledge_base', 'check_service_status', 'get_user_profile'],
      'Solution steps or escalation to support ticket',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 120)
    ),
    (
      'NAVIGATE_PLATFORM',
      'Help with Platform Navigation',
      'Guide users through EasyMO features and menus',
      'User is lost or unsure how to access a feature',
      ARRAY['search_knowledge_base', 'transfer_to_agent'],
      'Navigation instructions or transfer to relevant agent',
      false,
      jsonb_build_object('priority', 'medium', 'avg_duration_seconds', 60)
    ),
    (
      'HANDLE_PAYMENT_ISSUE',
      'Handle Payment Disputes',
      'Collect details and escalate payment-related issues',
      'User reports failed payment, missing refund, or incorrect charges',
      ARRAY['get_user_profile', 'create_support_ticket'],
      'Support ticket created with finance team escalation',
      true,
      jsonb_build_object('priority', 'urgent', 'avg_duration_seconds', 180, 'sla_minutes', 15)
    ),
    (
      'COLLECT_FEEDBACK',
      'Collect User Feedback',
      'Gather suggestions, complaints, or feature requests',
      'User wants to report feedback or suggest improvements',
      ARRAY['create_support_ticket'],
      'Feedback logged and acknowledged',
      false,
      jsonb_build_object('priority', 'low', 'avg_duration_seconds', 90)
    ),
    (
      'ACCOUNT_ASSISTANCE',
      'Account and Profile Assistance',
      'Help with account settings, profile updates, and preferences',
      'User needs help with their account or profile',
      ARRAY['get_user_profile', 'search_knowledge_base'],
      'Account issue resolved or instructions provided',
      false,
      jsonb_build_object('priority', 'medium', 'avg_duration_seconds', 90)
    ),
    (
      'ROUTE_TO_SPECIALIST',
      'Route to Specialized Agent',
      'Identify user intent and transfer to appropriate AI agent',
      'User request is better handled by specialized agent (Waiter, Rides, etc.)',
      ARRAY['transfer_to_agent'],
      'User transferred with context summary',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 30)
    )
) AS task(code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
WHERE a.slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. INSERT KNOWLEDGE BASE ENTRIES
-- =====================================================================

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, config)
SELECT
  a.id,
  kb.code,
  kb.name,
  kb.description,
  'embedded',
  'semantic_search',
  jsonb_build_object(
    'category', kb.category,
    'tags', kb.tags,
    'source_url', kb.source_url
  )
FROM public.ai_agents a,
LATERAL (
  VALUES
    (
      'KB-SUPPORT-001',
      'How to Order Food on EasyMO',
      E'To order food using EasyMO:\n1. From the home menu, tap "Waiter AI"\n2. Browse nearby restaurants or search by cuisine\n3. Select items and add to your order\n4. Review your cart and confirm\n5. Choose payment method (Mobile Money)\n6. Track your delivery in real-time\n\nDelivery usually takes 20-45 minutes depending on restaurant and location.',
      'features',
      ARRAY['waiter', 'food', 'ordering', 'delivery'],
      'https://easymo.rw/help/order-food'
    ),
    (
      'KB-SUPPORT-002',
      'How to Book a Ride',
      E'To book a ride on EasyMO:\n1. Tap "Rides AI" from the home menu\n2. Enter your pickup location (or use GPS)\n3. Enter your destination\n4. Choose ride type (Moto, Car, Share)\n5. Confirm fare estimate\n6. Pay and track your driver\n\nYou can also schedule rides in advance for later pickup.',
      'features',
      ARRAY['rides', 'mobility', 'booking', 'transport'],
      'https://easymo.rw/help/book-ride'
    ),
    (
      'KB-SUPPORT-003',
      'Payment Methods Accepted',
      E'EasyMO accepts the following payment methods:\n- MTN Mobile Money\n- Airtel Money\n- EasyMO Wallet (prepaid)\n- Cash (for some services)\n\nTo add funds to your wallet:\n1. Go to Profile\n2. Tap "Top Up Wallet"\n3. Enter amount and choose Mobile Money provider\n4. Confirm on your phone\n\nPayments are instant and secure.',
      'payments',
      ARRAY['payment', 'mobile_money', 'wallet', 'mtn', 'airtel'],
      'https://easymo.rw/help/payments'
    ),
    (
      'KB-SUPPORT-004',
      'Account Login Issues',
      E'If you can''t log in:\n1. Make sure you''re using the correct phone number\n2. Check if you have network connectivity\n3. Restart WhatsApp and try again\n4. Clear app cache (Settings > Apps > WhatsApp > Clear Cache)\n\nIf the issue persists, contact support and we''ll reset your account within 1 hour.',
      'account',
      ARRAY['login', 'account', 'troubleshooting', 'access'],
      'https://easymo.rw/help/login-issues'
    ),
    (
      'KB-SUPPORT-005',
      'Failed Payment / Money Deducted',
      E'If your payment failed but money was deducted:\n1. Note the transaction reference number\n2. Take a screenshot of the deduction message\n3. Contact support immediately\n4. Provide: phone number, amount, time of transaction\n\nOur finance team will investigate and refund within 24 hours. Most refunds are processed within 2-4 hours.',
      'payments',
      ARRAY['payment', 'refund', 'failed_payment', 'dispute'],
      'https://easymo.rw/help/payment-issues'
    )
) AS kb(code, name, description, category, tags, source_url)
WHERE a.slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 7. UPDATE HOME MENU TO USE SUPPORT AGENT
-- =====================================================================

-- Update the customer_support menu item to use the support agent
UPDATE public.whatsapp_home_menu_items
SET 
  updated_at = now()
WHERE key = 'customer_support'
  OR key IN ('support', 'help');

COMMIT;
