/**
 * Messaging Tools for AGI Integration
 * 
 * Provides tools for AI agents to send messages and manage sessions
 * across WhatsApp and SMS channels.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { logStructuredEvent } from '../observability.ts';
import { sendDualChannelNotification, type DualChannelConfig } from '../notifications/dual-channel.ts';
import { 
  getOrCreateSession, 
  updateSessionStatus, 
  updateSessionContext,
  getSessionContext,
  type SessionContext 
} from '../session/omnichannel-session.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Tool: Send WhatsApp message
 */
export const messaging_send_whatsapp = {
  name: 'messaging_send_whatsapp',
  description: 'Send a message to user via WhatsApp. Use this for rich formatted messages with emojis.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message content to send via WhatsApp. Can include emojis and basic formatting.',
      },
      profile_id: {
        type: 'string',
        description: 'User profile ID to send message to',
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID to associate message with',
      },
    },
    required: ['message', 'profile_id'],
  },
};

/**
 * Tool: Send SMS message
 */
export const messaging_send_sms = {
  name: 'messaging_send_sms',
  description: 'Send a message to user via SMS. Use this for simple plain text messages (160 chars recommended).',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message content to send via SMS. Keep concise (max 480 chars for 3 segments).',
      },
      profile_id: {
        type: 'string',
        description: 'User profile ID to send message to',
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID to associate message with',
      },
    },
    required: ['message', 'profile_id'],
  },
};

/**
 * Tool: Send dual-channel message (WhatsApp + SMS)
 */
export const messaging_send_dual_channel = {
  name: 'messaging_send_dual_channel',
  description: 'Send message to both WhatsApp AND SMS simultaneously. Use after important events like call summaries.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message content to send. Will be formatted appropriately for each channel.',
      },
      subject: {
        type: 'string',
        description: 'Optional subject/title for the message',
      },
      profile_id: {
        type: 'string',
        description: 'User profile ID to send message to',
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID to associate message with',
      },
      message_type: {
        type: 'string',
        description: 'Type of message (e.g., call_summary, notification, response)',
        enum: ['call_summary', 'notification', 'response', 'follow_up', 'update'],
      },
    },
    required: ['message', 'profile_id'],
  },
};

/**
 * Tool: Get or create omnichannel session
 */
export const session_get_or_create = {
  name: 'session_get_or_create',
  description: 'Get active session or create new one for tracking conversation across channels',
  parameters: {
    type: 'object',
    properties: {
      profile_id: {
        type: 'string',
        description: 'User profile ID',
      },
      primary_channel: {
        type: 'string',
        description: 'Channel that initiated the session',
        enum: ['voice', 'whatsapp', 'sms'],
      },
      call_id: {
        type: 'string',
        description: 'Optional call ID if session started from a call',
      },
      agent_id: {
        type: 'string',
        description: 'Agent identifier (e.g., call_center_ai, jobs_ai)',
      },
      intent: {
        type: 'string',
        description: 'User intent or topic (e.g., property_inquiry, job_search)',
      },
    },
    required: ['profile_id'],
  },
};

/**
 * Tool: Update session status
 */
export const session_update_status = {
  name: 'session_update_status',
  description: 'Update session status (active, closed, follow_up) and optionally add context',
  parameters: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID to update',
      },
      status: {
        type: 'string',
        description: 'New session status',
        enum: ['active', 'closed', 'follow_up'],
      },
      context: {
        type: 'object',
        description: 'Optional context data to merge into session',
      },
    },
    required: ['session_id', 'status'],
  },
};

/**
 * Tool: Add context to session
 */
export const session_add_context = {
  name: 'session_add_context',
  description: 'Add or update context data in the session for cross-channel continuity',
  parameters: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID to update',
      },
      context: {
        type: 'object',
        description: 'Context data to add/update (e.g., {property_id: "123", budget: 300000})',
      },
    },
    required: ['session_id', 'context'],
  },
};

/**
 * Tool: Get session context
 */
export const session_get_context = {
  name: 'session_get_context',
  description: 'Retrieve session context data to continue conversation from where it left off',
  parameters: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID to retrieve context from',
      },
    },
    required: ['session_id'],
  },
};

/**
 * Execute messaging tool
 */
export async function executeMessagingTool(
  toolName: string,
  args: any,
  config: DualChannelConfig
): Promise<any> {
  const correlationId = crypto.randomUUID();

  logStructuredEvent('MESSAGING_TOOL_EXECUTE', {
    toolName,
    args: { ...args, message: args.message ? `[${args.message.length} chars]` : undefined },
    correlationId,
  });

  try {
    switch (toolName) {
      case 'messaging_send_whatsapp': {
        // Get profile phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number, whatsapp_jid')
          .eq('id', args.profile_id)
          .single();

        if (!profile?.phone_number) {
          return { success: false, error: 'Profile phone number not found' };
        }

        const result = await sendDualChannelNotification(
          config,
          {
            phoneNumber: profile.phone_number,
            whatsappJid: profile.whatsapp_jid,
            profileId: args.profile_id,
            message: args.message,
            messageType: 'agent_message',
            sessionId: args.session_id,
          },
          correlationId
        );

        return {
          success: result.whatsapp.sent,
          whatsapp_message_id: result.whatsapp.messageId,
          error: result.whatsapp.error,
        };
      }

      case 'messaging_send_sms': {
        // Get profile phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', args.profile_id)
          .single();

        if (!profile?.phone_number) {
          return { success: false, error: 'Profile phone number not found' };
        }

        const result = await sendDualChannelNotification(
          config,
          {
            phoneNumber: profile.phone_number,
            profileId: args.profile_id,
            message: args.message,
            messageType: 'agent_message',
            sessionId: args.session_id,
          },
          correlationId
        );

        return {
          success: result.sms.sent,
          sms_message_id: result.sms.messageId,
          error: result.sms.error,
        };
      }

      case 'messaging_send_dual_channel': {
        // Get profile phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number, whatsapp_jid')
          .eq('id', args.profile_id)
          .single();

        if (!profile?.phone_number) {
          return { success: false, error: 'Profile phone number not found' };
        }

        const result = await sendDualChannelNotification(
          config,
          {
            phoneNumber: profile.phone_number,
            whatsappJid: profile.whatsapp_jid,
            profileId: args.profile_id,
            message: args.message,
            subject: args.subject,
            messageType: args.message_type || 'notification',
            sessionId: args.session_id,
          },
          correlationId
        );

        return {
          success: result.whatsapp.sent || result.sms.sent,
          whatsapp_sent: result.whatsapp.sent,
          sms_sent: result.sms.sent,
          whatsapp_message_id: result.whatsapp.messageId,
          sms_message_id: result.sms.messageId,
          errors: {
            whatsapp: result.whatsapp.error,
            sms: result.sms.error,
          },
        };
      }

      case 'session_get_or_create': {
        const session = await getOrCreateSession(args.profile_id, {
          primaryChannel: args.primary_channel,
          callId: args.call_id,
          agentId: args.agent_id,
          intent: args.intent,
        });

        if (!session) {
          return { success: false, error: 'Failed to create session' };
        }

        return {
          success: true,
          session_id: session.id,
          status: session.status,
          context: session.context,
        };
      }

      case 'session_update_status': {
        const success = await updateSessionStatus(
          args.session_id,
          args.status,
          args.context
        );

        return { success };
      }

      case 'session_add_context': {
        const success = await updateSessionContext(
          args.session_id,
          args.context
        );

        return { success };
      }

      case 'session_get_context': {
        const context = await getSessionContext(args.session_id);

        if (!context) {
          return { success: false, error: 'Session not found' };
        }

        return {
          success: true,
          context,
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    logStructuredEvent('MESSAGING_TOOL_ERROR', {
      toolName,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all messaging tools definitions
 */
export function getMessagingTools() {
  return [
    messaging_send_whatsapp,
    messaging_send_sms,
    messaging_send_dual_channel,
    session_get_or_create,
    session_update_status,
    session_add_context,
    session_get_context,
  ];
}
