/**
 * Post-Call Notification Function
 * 
 * Sends call summaries via both WhatsApp AND SMS after voice calls end.
 * Creates/updates omnichannel sessions for follow-up conversations.
 * 
 * Triggered by: wa-webhook-voice-calls on call termination
 * 
 * Flow:
 * 1. Fetch call summary from call_summaries table
 * 2. Get user profile and check channel preferences
 * 3. Create/update omnichannel_session with status='follow_up'
 * 4. Send summary via WhatsApp (if available) AND SMS
 * 5. Log delivery in message_delivery_log
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';
import { sendDualChannelNotification, type DualChannelConfig } from '../_shared/notifications/dual-channel.ts';
import { getOrCreateSession, markSummarySent } from '../_shared/session/omnichannel-session.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Configuration
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';
const MTN_SMS_API_KEY = Deno.env.get('MTN_SMS_API_KEY') ?? '';
const MTN_SMS_API_SECRET = Deno.env.get('MTN_SMS_API_SECRET') ?? '';
const MTN_SMS_SENDER_ID = Deno.env.get('MTN_SMS_SENDER_ID') ?? 'EasyMO';

interface PostCallNotifyRequest {
  call_id: string;
  phone_number?: string;
}

/**
 * Format call summary for notification
 */
function formatCallSummary(summary: any): { subject: string; message: string } {
  const subject = 'EasyMO Call Summary';
  
  let message = summary.summary || 'Your call has been completed.';
  
  // Add next actions if available
  if (summary.next_actions && Array.isArray(summary.next_actions) && summary.next_actions.length > 0) {
    message += '\n\nNext steps:';
    summary.next_actions.forEach((action: string, index: number) => {
      message += `\n${index + 1}. ${action}`;
    });
  }
  
  // Add contact info
  message += '\n\nNeed help? Reply to this message or call us anytime.';
  
  return { subject, message };
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  logStructuredEvent('POST_CALL_NOTIFY_RECEIVED', {
    method: req.method,
    correlationId,
  });

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: PostCallNotifyRequest = await req.json();
    const { call_id, phone_number } = payload;

    if (!call_id) {
      logStructuredEvent('POST_CALL_NOTIFY_MISSING_CALL_ID', {
        correlationId,
      }, 'error');
      
      return new Response(JSON.stringify({ error: 'call_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logStructuredEvent('POST_CALL_NOTIFY_PROCESSING', {
      callId: call_id,
      phoneNumber: phone_number,
      correlationId,
    });

    // 1. Fetch call record and summary
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*, call_summaries(*)')
      .eq('id', call_id)
      .single();

    if (callError || !call) {
      logStructuredEvent('POST_CALL_NOTIFY_CALL_NOT_FOUND', {
        callId: call_id,
        error: callError?.message,
        correlationId,
      }, 'error');
      
      return new Response(JSON.stringify({ error: 'Call not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summary = call.call_summaries;
    const fromNumber = phone_number || call.from_number;

    if (!fromNumber) {
      logStructuredEvent('POST_CALL_NOTIFY_NO_PHONE_NUMBER', {
        callId: call_id,
        correlationId,
      }, 'error');
      
      return new Response(JSON.stringify({ error: 'Phone number not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Get user profile
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', fromNumber)
      .maybeSingle();

    if (!profile) {
      logStructuredEvent('POST_CALL_NOTIFY_PROFILE_NOT_FOUND', {
        callId: call_id,
        phoneNumber: fromNumber,
        correlationId,
      }, 'warn');
      
      // Create a basic profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone_number: fromNumber,
          display_name: fromNumber,
          has_whatsapp: false,
          allows_sms: true,
        })
        .select()
        .single();
        
      if (createError || !newProfile) {
        logStructuredEvent('POST_CALL_NOTIFY_PROFILE_CREATE_ERROR', {
          callId: call_id,
          phoneNumber: fromNumber,
          error: createError?.message,
          correlationId,
        }, 'error');
        
        return new Response(JSON.stringify({ error: 'Failed to create profile' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Use newly created profile
      profile = newProfile;
    }

    logStructuredEvent('POST_CALL_NOTIFY_PROFILE_FOUND', {
      callId: call_id,
      profileId: profile.id,
      hasWhatsApp: profile.has_whatsapp,
      allowsSms: profile.allows_sms,
      correlationId,
    });

    // 3. Create/update omnichannel session
    const session = await getOrCreateSession(profile.id, {
      primaryChannel: 'voice',
      callId: call_id,
      agentId: call.agent_id,
      intent: summary?.main_intent,
    });

    if (!session) {
      logStructuredEvent('POST_CALL_NOTIFY_SESSION_CREATE_ERROR', {
        callId: call_id,
        profileId: profile.id,
        correlationId,
      }, 'error');
      
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logStructuredEvent('POST_CALL_NOTIFY_SESSION_CREATED', {
      callId: call_id,
      sessionId: session.id,
      correlationId,
    });

    // 4. Format and send summary via both channels
    const { subject, message } = formatCallSummary(summary);

    const dualChannelConfig: DualChannelConfig = {
      whatsappAccessToken: WHATSAPP_ACCESS_TOKEN,
      whatsappPhoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      smsConfig: {
        apiKey: MTN_SMS_API_KEY,
        apiSecret: MTN_SMS_API_SECRET,
        senderId: MTN_SMS_SENDER_ID,
      },
    };

    const notificationResult = await sendDualChannelNotification(
      dualChannelConfig,
      {
        phoneNumber: fromNumber,
        whatsappJid: profile.whatsapp_jid,
        profileId: profile.id,
        subject,
        message,
        messageType: 'call_summary',
        sessionId: session.id,
        metadata: {
          call_id,
          agent_id: call.agent_id,
          duration: call.duration_seconds,
          main_intent: summary?.main_intent,
        },
      },
      correlationId
    );

    // 5. Mark summary as sent in session
    if (notificationResult.whatsapp.sent) {
      await markSummarySent(session.id, 'whatsapp');
    }
    if (notificationResult.sms.sent) {
      await markSummarySent(session.id, 'sms');
    }

    // 6. Update session status to follow_up
    await supabase
      .from('omnichannel_sessions')
      .update({
        status: 'follow_up',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    logStructuredEvent('POST_CALL_NOTIFY_SUCCESS', {
      callId: call_id,
      sessionId: session.id,
      whatsappSent: notificationResult.whatsapp.sent,
      smsSent: notificationResult.sms.sent,
      correlationId,
    });

    return new Response(JSON.stringify({
      success: true,
      call_id,
      session_id: session.id,
      notifications: {
        whatsapp: {
          sent: notificationResult.whatsapp.sent,
          message_id: notificationResult.whatsapp.messageId,
          error: notificationResult.whatsapp.error,
        },
        sms: {
          sent: notificationResult.sms.sent,
          message_id: notificationResult.sms.messageId,
          error: notificationResult.sms.error,
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStructuredEvent('POST_CALL_NOTIFY_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
    }, 'error');

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
