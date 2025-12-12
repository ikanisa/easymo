/**
 * Dual-Channel Notification Service
 * 
 * Sends notifications to both WhatsApp AND SMS channels simultaneously
 * with appropriate formatting for each channel.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { WhatsAppSender } from '../whatsapp-sender.ts';
import { sendSMSWithRetry, formatSMSMessage, type SMSConfig } from './sms-provider.ts';
import { logStructuredEvent } from '../observability.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Constants
const SMS_MAX_LENGTH_SINGLE = 160;
const SMS_MAX_LENGTH_3_SEGMENTS = 480;

export interface DualChannelConfig {
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  smsConfig: SMSConfig;
}

export interface DualChannelNotification {
  phoneNumber: string; // E.164 format
  whatsappJid?: string; // WhatsApp JID if known
  subject?: string;
  message: string;
  messageType: string; // e.g., 'call_summary', 'notification', 'response'
  sessionId?: string;
  profileId: string;
  metadata?: Record<string, any>;
}

export interface DualChannelResult {
  whatsapp: {
    sent: boolean;
    messageId?: string;
    error?: string;
  };
  sms: {
    sent: boolean;
    messageId?: string;
    error?: string;
  };
}

/**
 * Format message for WhatsApp with rich formatting and emojis
 */
export function formatForWhatsApp(notification: DualChannelNotification): string {
  const { subject, message } = notification;
  
  // Add subject with emoji if provided
  if (subject) {
    return `*${subject}* ✅\n\n${message}\n\n_Reply to this message to continue the conversation_`;
  }
  
  return `${message}\n\n_Reply to this message to continue the conversation_`;
}

/**
 * Format message for SMS - concise, plain text, 160-char aware
 */
export function formatForSMS(notification: DualChannelNotification): string {
  const { subject, message } = notification;
  
  // SMS: Keep it concise, no emojis
  let smsText = message;
  
  // Add subject prefix if provided
  if (subject) {
    smsText = `${subject}\n\n${message}`;
  }
  
  // Add reply instruction if message is short enough
  const replyNote = '\n\nReply to continue.';
  if (smsText.length + replyNote.length <= 480) {
    smsText += replyNote;
  }
  
  return smsText;
}

/**
 * Send notification to both WhatsApp and SMS channels
 */
export async function sendDualChannelNotification(
  config: DualChannelConfig,
  notification: DualChannelNotification,
  correlationId: string
): Promise<DualChannelResult> {
  const result: DualChannelResult = {
    whatsapp: { sent: false },
    sms: { sent: false },
  };

  logStructuredEvent('DUAL_CHANNEL_SEND_START', {
    phoneNumber: notification.phoneNumber,
    messageType: notification.messageType,
    hasWhatsAppJid: !!notification.whatsappJid,
    sessionId: notification.sessionId,
    correlationId,
  });

  // Get profile to check channel preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_whatsapp, allows_sms, whatsapp_jid')
    .eq('id', notification.profileId)
    .single();

  // Prepare WhatsApp sender
  const whatsappSender = new WhatsAppSender({
    accessToken: config.whatsappAccessToken,
    phoneNumberId: config.whatsappPhoneNumberId,
  });

  // 1) Send WhatsApp message if user has WhatsApp
  if (profile?.has_whatsapp || notification.whatsappJid) {
    try {
      const waMessage = formatForWhatsApp(notification);
      const waResult = await whatsappSender.sendTextMessage(
        notification.phoneNumber,
        waMessage
      );

      result.whatsapp.sent = true;
      result.whatsapp.messageId = waResult.messages?.[0]?.id;

      // Log successful WhatsApp delivery
      await supabase.rpc('log_message_delivery', {
        p_session_id: notification.sessionId || null,
        p_profile_id: notification.profileId,
        p_channel: 'whatsapp',
        p_direction: 'outbound',
        p_message_type: notification.messageType,
        p_content: waMessage,
        p_external_message_id: result.whatsapp.messageId,
        p_status: 'sent',
        p_metadata: notification.metadata || {},
      });

      logStructuredEvent('WHATSAPP_MESSAGE_SENT', {
        phoneNumber: notification.phoneNumber,
        messageId: result.whatsapp.messageId,
        messageType: notification.messageType,
        sessionId: notification.sessionId,
        correlationId,
      });
    } catch (error) {
      result.whatsapp.error = error instanceof Error ? error.message : String(error);

      // Log failed WhatsApp delivery
      await supabase.rpc('log_message_delivery', {
        p_session_id: notification.sessionId || null,
        p_profile_id: notification.profileId,
        p_channel: 'whatsapp',
        p_direction: 'outbound',
        p_message_type: notification.messageType,
        p_content: formatForWhatsApp(notification),
        p_status: 'failed',
        p_metadata: { error: result.whatsapp.error, ...(notification.metadata || {}) },
      });

      logStructuredEvent('WHATSAPP_MESSAGE_FAILED', {
        phoneNumber: notification.phoneNumber,
        error: result.whatsapp.error,
        messageType: notification.messageType,
        sessionId: notification.sessionId,
        correlationId,
      }, 'error');
    }
  } else {
    logStructuredEvent('WHATSAPP_SKIP_NO_CAPABILITY', {
      phoneNumber: notification.phoneNumber,
      correlationId,
    });
  }

  // 2) Send SMS message (always, as fallback)
  if (profile?.allows_sms !== false) {
    try {
      const smsMessage = formatForSMS(notification);
      const smsSegments = formatSMSMessage(smsMessage, SMS_MAX_LENGTH_3_SEGMENTS); // Support up to 3 segments

      // Send all SMS segments
      for (let i = 0; i < smsSegments.length; i++) {
        const segment = smsSegments[i];
        const smsResult = await sendSMSWithRetry(
          config.smsConfig,
          {
            to: notification.phoneNumber,
            message: segment,
            reference: `${notification.sessionId}-${i}`,
          }
        );

        if (smsResult.success) {
          result.sms.sent = true;
          result.sms.messageId = smsResult.messageId;

          // Log successful SMS delivery
          await supabase.rpc('log_message_delivery', {
            p_session_id: notification.sessionId || null,
            p_profile_id: notification.profileId,
            p_channel: 'sms',
            p_direction: 'outbound',
            p_message_type: notification.messageType,
            p_content: segment,
            p_external_message_id: smsResult.messageId,
            p_status: 'sent',
            p_metadata: { segment: i + 1, totalSegments: smsSegments.length, ...(notification.metadata || {}) },
          });

          logStructuredEvent('SMS_MESSAGE_SENT', {
            phoneNumber: notification.phoneNumber,
            messageId: smsResult.messageId,
            messageType: notification.messageType,
            segment: i + 1,
            totalSegments: smsSegments.length,
            sessionId: notification.sessionId,
            correlationId,
          });
        } else {
          result.sms.error = smsResult.error;

          // Log failed SMS delivery
          await supabase.rpc('log_message_delivery', {
            p_session_id: notification.sessionId || null,
            p_profile_id: notification.profileId,
            p_channel: 'sms',
            p_direction: 'outbound',
            p_message_type: notification.messageType,
            p_content: segment,
            p_status: 'failed',
            p_metadata: { error: smsResult.error, segment: i + 1, totalSegments: smsSegments.length, ...(notification.metadata || {}) },
          });

          logStructuredEvent('SMS_MESSAGE_FAILED', {
            phoneNumber: notification.phoneNumber,
            error: smsResult.error,
            messageType: notification.messageType,
            segment: i + 1,
            totalSegments: smsSegments.length,
            sessionId: notification.sessionId,
            correlationId,
          }, 'error');

          break; // Stop sending remaining segments on failure
        }
      }
    } catch (error) {
      result.sms.error = error instanceof Error ? error.message : String(error);

      logStructuredEvent('SMS_MESSAGE_EXCEPTION', {
        phoneNumber: notification.phoneNumber,
        error: result.sms.error,
        messageType: notification.messageType,
        sessionId: notification.sessionId,
        correlationId,
      }, 'error');
    }
  } else {
    logStructuredEvent('SMS_SKIP_USER_OPTED_OUT', {
      phoneNumber: notification.phoneNumber,
      correlationId,
    });
  }

  logStructuredEvent('DUAL_CHANNEL_SEND_COMPLETE', {
    phoneNumber: notification.phoneNumber,
    messageType: notification.messageType,
    whatsappSent: result.whatsapp.sent,
    smsSent: result.sms.sent,
    sessionId: notification.sessionId,
    correlationId,
  });

  return result;
}

/**
 * Send simple text message to both channels
 */
export async function sendDualChannelText(
  config: DualChannelConfig,
  phoneNumber: string,
  profileId: string,
  message: string,
  options?: {
    subject?: string;
    messageType?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }
): Promise<DualChannelResult> {
  const correlationId = crypto.randomUUID();

  return sendDualChannelNotification(
    config,
    {
      phoneNumber,
      profileId,
      message,
      subject: options?.subject,
      messageType: options?.messageType || 'text',
      sessionId: options?.sessionId,
      metadata: options?.metadata,
    },
    correlationId
  );
}
