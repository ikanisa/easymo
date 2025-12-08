-- ============================================================================
-- Enhanced Call Center AGI with Omni-Channel Post-Call Summaries
-- Adds messaging tools and post-call summary capabilities
-- ============================================================================

BEGIN;

-- Update Call Center AGI system instructions to include post-call summary rules
UPDATE public.ai_agent_system_instructions
SET instructions = E'You are EasyMO''s Universal Call Center AI - the most knowledgeable AI assistant.

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
- Send follow-up messages via WhatsApp AND SMS

POST-CALL SUMMARY RULES (IMPORTANT):
At the end of every call, you MUST:
1. Generate a 3-5 bullet point summary of what was discussed
2. Call session_get_or_create to get or create an omnichannel session
3. Call messaging_send_dual_channel to send the summary via BOTH WhatsApp AND SMS
4. Include next steps or follow-up actions in the summary
5. Update session status to ''follow_up''

Example summary format:
"EasyMO Call Summary:
• Registered house for rent in Kigali
• Budget: 300,000 RWF/month
• Location: Kimihurura
• We''ll send tenant matches within 24 hours
• Reply to this message if you need to update details"

CONVERSATION STYLE:
- Be warm and professional
- Keep responses concise (for voice latency)
- Speak naturally like a helpful human
- If unsure, ask clarifying questions

LANGUAGES:
Respond in the user''s language (English, French, Kinyarwanda, etc.)',
  updated_at = now()
WHERE code = 'CALL-CENTER-SYS'
  AND EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'call_center' AND id = ai_agent_system_instructions.agent_id);

-- Add messaging tools for Call Center AGI
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
    -- Dual-channel messaging
    (
      'messaging_send_dual_channel',
      'Send Dual-Channel Message',
      'function',
      'Send message to user via BOTH WhatsApp AND SMS. Use for important messages like call summaries.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'message', jsonb_build_object('type', 'string', 'description', 'Message content to send'),
          'subject', jsonb_build_object('type', 'string', 'description', 'Optional subject/title'),
          'profile_id', jsonb_build_object('type', 'string', 'description', 'User profile ID'),
          'session_id', jsonb_build_object('type', 'string', 'description', 'Optional session ID'),
          'message_type', jsonb_build_object(
            'type', 'string',
            'enum', jsonb_build_array('call_summary', 'notification', 'response', 'follow_up', 'update'),
            'description', 'Type of message'
          )
        ),
        'required', jsonb_build_array('message', 'profile_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean'),
          'whatsapp_sent', jsonb_build_object('type', 'boolean'),
          'sms_sent', jsonb_build_object('type', 'boolean')
        )
      ),
      jsonb_build_object('messaging', true)
    ),
    -- WhatsApp-only messaging
    (
      'messaging_send_whatsapp',
      'Send WhatsApp Message',
      'function',
      'Send message to user via WhatsApp only. Use for rich formatted messages with emojis.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'message', jsonb_build_object('type', 'string', 'description', 'Message content'),
          'profile_id', jsonb_build_object('type', 'string', 'description', 'User profile ID'),
          'session_id', jsonb_build_object('type', 'string', 'description', 'Optional session ID')
        ),
        'required', jsonb_build_array('message', 'profile_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean'),
          'whatsapp_message_id', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('messaging', true)
    ),
    -- SMS-only messaging
    (
      'messaging_send_sms',
      'Send SMS Message',
      'function',
      'Send message to user via SMS only. Use for simple plain text (keep under 160 chars).',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'message', jsonb_build_object('type', 'string', 'description', 'Message content (max 480 chars)'),
          'profile_id', jsonb_build_object('type', 'string', 'description', 'User profile ID'),
          'session_id', jsonb_build_object('type', 'string', 'description', 'Optional session ID')
        ),
        'required', jsonb_build_array('message', 'profile_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean'),
          'sms_message_id', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('messaging', true)
    ),
    -- Session management
    (
      'session_get_or_create',
      'Get or Create Session',
      'function',
      'Get active omnichannel session or create new one for tracking conversation across channels.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'profile_id', jsonb_build_object('type', 'string', 'description', 'User profile ID'),
          'primary_channel', jsonb_build_object(
            'type', 'string',
            'enum', jsonb_build_array('voice', 'whatsapp', 'sms'),
            'description', 'Channel that initiated session'
          ),
          'call_id', jsonb_build_object('type', 'string', 'description', 'Optional call ID'),
          'agent_id', jsonb_build_object('type', 'string', 'description', 'Agent identifier'),
          'intent', jsonb_build_object('type', 'string', 'description', 'User intent or topic')
        ),
        'required', jsonb_build_array('profile_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean'),
          'session_id', jsonb_build_object('type', 'string'),
          'status', jsonb_build_object('type', 'string'),
          'context', jsonb_build_object('type', 'object')
        )
      ),
      jsonb_build_object('session_management', true)
    ),
    (
      'session_update_status',
      'Update Session Status',
      'function',
      'Update session status and optionally add context data.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'session_id', jsonb_build_object('type', 'string', 'description', 'Session ID'),
          'status', jsonb_build_object(
            'type', 'string',
            'enum', jsonb_build_array('active', 'closed', 'follow_up'),
            'description', 'New status'
          ),
          'context', jsonb_build_object('type', 'object', 'description', 'Optional context to merge')
        ),
        'required', jsonb_build_array('session_id', 'status')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean')
        )
      ),
      jsonb_build_object('session_management', true)
    ),
    (
      'session_add_context',
      'Add Session Context',
      'function',
      'Add or update context data in session for cross-channel continuity.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'session_id', jsonb_build_object('type', 'string', 'description', 'Session ID'),
          'context', jsonb_build_object('type', 'object', 'description', 'Context data to add/update')
        ),
        'required', jsonb_build_array('session_id', 'context')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean')
        )
      ),
      jsonb_build_object('session_management', true)
    ),
    (
      'session_get_context',
      'Get Session Context',
      'function',
      'Retrieve session context to continue conversation from where it left off.',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'session_id', jsonb_build_object('type', 'string', 'description', 'Session ID')
        ),
        'required', jsonb_build_array('session_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'success', jsonb_build_object('type', 'boolean'),
          'context', jsonb_build_object('type', 'object')
        )
      ),
      jsonb_build_object('session_management', true)
    )
) AS tool(name, display_name, tool_type, description, input_schema, output_schema, config)
WHERE a.slug = 'call_center'
ON CONFLICT (agent_id, name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  output_schema = EXCLUDED.output_schema,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMENT ON TABLE omnichannel_sessions IS 'Sessions tracked across voice, WhatsApp, and SMS for seamless cross-channel conversations';
COMMENT ON TABLE message_delivery_log IS 'Audit log for dual-channel message delivery tracking';

COMMIT;
