/**
 * SMS Inbound Webhook Handler
 * 
 * Handles incoming SMS messages from MTN gateway.
 * Routes messages to AI agent and sends responses back via SMS.
 * 
 * Flow:
 * 1. Receive SMS from MTN gateway
 * 2. Look up profile by phone number
 * 3. Find active omnichannel session
 * 4. Route to AI agent (OpenAI) for response
 * 5. Send AI response back via SMS
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';
import { getActiveSession, updateSessionContext } from '../_shared/session/omnichannel-session.ts';
import { sendSMSWithRetry, type SMSConfig } from '../_shared/notifications/sms-provider.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Configuration
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const MTN_SMS_API_KEY = Deno.env.get('MTN_SMS_API_KEY') ?? '';
const MTN_SMS_API_SECRET = Deno.env.get('MTN_SMS_API_SECRET') ?? '';
const MTN_SMS_SENDER_ID = Deno.env.get('MTN_SMS_SENDER_ID') ?? 'EasyMO';
const MTN_WEBHOOK_SECRET = Deno.env.get('MTN_WEBHOOK_SECRET') ?? '';

interface SMSInboundPayload {
  from: string; // E.164 phone number
  to: string; // Our number
  message: string;
  timestamp?: string;
  message_id?: string;
  signature?: string;
}

/**
 * Verify MTN webhook signature
 */
function verifyMTNSignature(payload: string, signature: string): boolean {
  if (!MTN_WEBHOOK_SECRET || !signature) {
    return false;
  }

  // MTN uses HMAC-SHA256 for webhook signatures
  const encoder = new TextEncoder();
  const keyData = encoder.encode(MTN_WEBHOOK_SECRET);
  const messageData = encoder.encode(payload);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => 
    crypto.subtle.sign('HMAC', key, messageData)
  ).then(signatureBuffer => {
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return signatureHex === signature;
  }).catch(() => false);
}

/**
 * Get AI response for incoming SMS
 */
async function getAIResponse(
  message: string,
  sessionContext: any,
  profileInfo: any
): Promise<string> {
  const systemPrompt = `You are EasyMO AI assistant helping via SMS.
User: ${profileInfo.display_name || 'User'}
Context: ${sessionContext.last_intent || 'General assistance'}
Previous conversation: ${sessionContext.summary || 'New conversation'}

Guidelines:
- Keep responses SHORT (max 160 chars for single SMS, max 300 for urgent info)
- Be helpful, friendly, and concise
- If user asks for details, provide them but stay brief
- For complex requests, suggest calling or using WhatsApp
- Always acknowledge their message first`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Sorry, I could not process your message. Please try again.';
  } catch (error) {
    logStructuredEvent('AI_RESPONSE_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    }, 'error');
    
    return 'We received your message. Our team will respond shortly. For immediate help, please call us.';
  }
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  logStructuredEvent('SMS_INBOUND_WEBHOOK_RECEIVED', {
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
    const rawBody = await req.text();
    const payload: SMSInboundPayload = JSON.parse(rawBody);

    logStructuredEvent('SMS_INBOUND_RECEIVED', {
      from: payload.from,
      messageLength: payload.message?.length,
      messageId: payload.message_id,
      correlationId,
    });

    // Verify signature if provided
    if (payload.signature) {
      const isValid = await verifyMTNSignature(rawBody, payload.signature);
      if (!isValid) {
        logStructuredEvent('SMS_INBOUND_INVALID_SIGNATURE', {
          from: payload.from,
          correlationId,
        }, 'error');
        
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { from: phoneNumber, message, message_id: externalMessageId } = payload;

    if (!phoneNumber || !message) {
      logStructuredEvent('SMS_INBOUND_MISSING_DATA', {
        hasFrom: !!phoneNumber,
        hasMessage: !!message,
        correlationId,
      }, 'error');
      
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Look up profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (!profile) {
      logStructuredEvent('SMS_INBOUND_PROFILE_NOT_FOUND', {
        phoneNumber,
        correlationId,
      }, 'warn');
      
      // Create a basic profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone_number: phoneNumber,
          display_name: phoneNumber,
          has_whatsapp: false,
          allows_sms: true,
          last_active_channel: 'sms',
        })
        .select()
        .single();
        
      if (createError || !newProfile) {
        logStructuredEvent('SMS_INBOUND_PROFILE_CREATE_ERROR', {
          phoneNumber,
          error: createError?.message,
          correlationId,
        }, 'error');
        
        return new Response(JSON.stringify({ error: 'Failed to create profile' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      profile = newProfile;
    }

    // Update last active channel
    await supabase
      .from('profiles')
      .update({ last_active_channel: 'sms' })
      .eq('id', profile.id);

    // 2. Log inbound message
    await supabase.rpc('log_message_delivery', {
      p_session_id: null, // Will update after getting session
      p_profile_id: profile.id,
      p_channel: 'sms',
      p_direction: 'inbound',
      p_message_type: 'user_message',
      p_content: message,
      p_external_message_id: externalMessageId,
      p_status: 'delivered',
      p_metadata: { timestamp: payload.timestamp || new Date().toISOString() },
    });

    // 3. Get or create active session
    const session = await getActiveSession(profile.id);

    let sessionContext: any = {};
    let sessionId: string | undefined;

    if (session) {
      sessionId = session.id;
      sessionContext = session.context || {};
      
      // Update session to mark SMS as active channel
      await supabase
        .from('omnichannel_sessions')
        .update({
          active_channels: Array.from(new Set([...(session.active_channels || []), 'sms'])),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Extend by 24h
        })
        .eq('id', sessionId);

      logStructuredEvent('SMS_INBOUND_SESSION_FOUND', {
        sessionId,
        profileId: profile.id,
        correlationId,
      });
    } else {
      // Create new session via SMS
      const { data: newSessionId } = await supabase.rpc('get_or_create_omnichannel_session', {
        p_profile_id: profile.id,
        p_primary_channel: 'sms',
      });

      sessionId = newSessionId as string;

      logStructuredEvent('SMS_INBOUND_SESSION_CREATED', {
        sessionId,
        profileId: profile.id,
        correlationId,
      });
    }

    // 4. Get AI response
    const aiResponse = await getAIResponse(message, sessionContext, profile);

    logStructuredEvent('SMS_INBOUND_AI_RESPONSE_GENERATED', {
      sessionId,
      responseLength: aiResponse.length,
      correlationId,
    });

    // 5. Update session context with the conversation
    if (sessionId) {
      await updateSessionContext(sessionId, {
        last_sms_message: message,
        last_sms_response: aiResponse,
        last_sms_timestamp: new Date().toISOString(),
      });
    }

    // 6. Send AI response via SMS
    const smsConfig: SMSConfig = {
      apiKey: MTN_SMS_API_KEY,
      apiSecret: MTN_SMS_API_SECRET,
      senderId: MTN_SMS_SENDER_ID,
    };

    const smsResult = await sendSMSWithRetry(smsConfig, {
      to: phoneNumber,
      message: aiResponse,
      reference: sessionId,
    });

    if (smsResult.success) {
      // Log outbound response
      await supabase.rpc('log_message_delivery', {
        p_session_id: sessionId || null,
        p_profile_id: profile.id,
        p_channel: 'sms',
        p_direction: 'outbound',
        p_message_type: 'ai_response',
        p_content: aiResponse,
        p_external_message_id: smsResult.messageId,
        p_status: 'sent',
        p_metadata: { cost: smsResult.cost },
      });

      logStructuredEvent('SMS_INBOUND_RESPONSE_SENT', {
        sessionId,
        smsMessageId: smsResult.messageId,
        correlationId,
      });
    } else {
      logStructuredEvent('SMS_INBOUND_RESPONSE_FAILED', {
        sessionId,
        error: smsResult.error,
        correlationId,
      }, 'error');
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      response_sent: smsResult.success,
      sms_message_id: smsResult.messageId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStructuredEvent('SMS_INBOUND_WEBHOOK_ERROR', {
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
