/**
 * WhatsApp Voice Calls Handler
 * Handles real-time voice calls (NOT voice messages)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const VOICE_GATEWAY_URL = Deno.env.get('VOICE_GATEWAY_URL') ?? 'http://voice-gateway:3000';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';

// Validate environment variables at startup and log warnings
let envValidated = false;
function validateEnvironment(correlationId: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!VOICE_GATEWAY_URL || VOICE_GATEWAY_URL === 'http://voice-gateway:3000') {
    warnings.push('VOICE_GATEWAY_URL is not configured or using default Docker hostname (unreachable from Edge Functions)');
  }
  
  if (!WHATSAPP_ACCESS_TOKEN) {
    warnings.push('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  
  if (!WHATSAPP_PHONE_NUMBER_ID) {
    warnings.push('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }
  
  if (warnings.length > 0 && !envValidated) {
    logStructuredEvent('WA_VOICE_ENV_WARNING', {
      warnings,
      voiceGatewayConfigured: !!VOICE_GATEWAY_URL && VOICE_GATEWAY_URL !== 'http://voice-gateway:3000',
      whatsappTokenConfigured: !!WHATSAPP_ACCESS_TOKEN,
      whatsappPhoneIdConfigured: !!WHATSAPP_PHONE_NUMBER_ID,
      correlationId,
    }, 'warn');
    envValidated = true;
  }
  
  return { valid: warnings.length === 0, warnings };
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();

  // Entry-point logging - log immediately when request is received
  logStructuredEvent('WA_VOICE_REQUEST_RECEIVED', {
    method: req.method,
    path: url.pathname,
    hasSignature: !!req.headers.get('x-hub-signature-256'),
    correlationId,
  });

  // Validate environment variables on first request
  validateEnvironment(correlationId);

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Correlation-ID', correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
    return respond({ status: 'healthy', service: 'wa-webhook-voice-calls' });
  }

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    logStructuredEvent('WA_VOICE_VERIFICATION_ATTEMPT', {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge,
      correlationId,
    });
    
    if (mode === 'subscribe' && token === Deno.env.get('WA_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return respond({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await req.text();
    
    logStructuredEvent('WA_VOICE_BODY_RECEIVED', {
      bodyLength: rawBody.length,
      correlationId,
    });
    
    const signature = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? Deno.env.get('WA_APP_SECRET');
    
    if (signature && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        logStructuredEvent('WA_VOICE_ERROR', {
          stage: 'signature_verification',
          error: 'Invalid webhook signature',
          correlationId,
        }, 'error');
        return respond({ error: 'invalid_signature' }, { status: 401 });
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      logStructuredEvent('WA_VOICE_ERROR', {
        stage: 'parsing',
        error: parseError instanceof Error ? parseError.message : 'JSON parse failed',
        correlationId,
      }, 'error');
      return respond({ error: 'invalid_json' }, { status: 400 });
    }
    
    const call = payload?.entry?.[0]?.changes?.[0]?.value?.call;
    
    // Log parsing result (helpful for debugging non-call events)
    logStructuredEvent('WA_VOICE_PAYLOAD_PARSED', {
      hasEntry: !!payload?.entry,
      hasChanges: !!payload?.entry?.[0]?.changes,
      hasCall: !!call,
      eventType: call?.event || 'none',
      correlationId,
    });
    
    if (!call) {
      return respond({ success: true, message: 'not_a_call_event' });
    }

    const { event: callEvent, id: callId, from: fromNumber, to: toNumber } = call;

    logStructuredEvent('WA_VOICE_CALL_EVENT', {
      callId,
      event: callEvent,
      from: fromNumber?.slice(-4),
      correlationId,
    });

    switch (callEvent) {
      case 'ringing':
        await handleIncomingCall(callId, fromNumber, toNumber, correlationId);
        break;
      case 'accepted':
        logStructuredEvent('WA_VOICE_CALL_ACCEPTED', { callId, correlationId });
        break;
      case 'rejected':
      case 'ended':
        await handleCallEnded(callId, correlationId);
        break;
      default:
        logStructuredEvent('WA_VOICE_UNKNOWN_EVENT', {
          callId,
          event: callEvent,
          correlationId,
        }, 'warn');
    }

    return respond({ success: true, call_id: callId, event: callEvent });

  } catch (error) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'handler',
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});

async function handleIncomingCall(
  callId: string,
  fromNumber: string,
  toNumber: string,
  correlationId: string
): Promise<void> {
  logStructuredEvent('WA_VOICE_CALL_HANDLING_START', {
    callId,
    from: fromNumber?.slice(-4),
    correlationId,
  });

  // Validate phone number format (E.164 format: +[country code][number])
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!fromNumber || !phoneRegex.test(fromNumber)) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'input_validation',
      callId,
      error: 'Invalid phone number format',
      correlationId,
    }, 'error');
    return; // Exit early for invalid input
  }

  // Stage 1: Profile lookup
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'profile_lookup',
    callId,
    correlationId,
  });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, name, preferred_language, phone_number, wa_id')
    .or(`phone_number.eq.${fromNumber},wa_id.eq.${fromNumber}`)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'profile_lookup',
      callId,
      error: profileError.message,
      correlationId,
    }, 'warn');
  }

  const language = profile?.preferred_language ?? 'en';
  const userName = profile?.name ?? 'there';

  // Stage 2: Voice Gateway connection
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'voice_gateway_connection',
    callId,
    voiceGatewayUrl: VOICE_GATEWAY_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // mask credentials if any
    correlationId,
  });

  // Check if Voice Gateway is properly configured
  if (!VOICE_GATEWAY_URL || VOICE_GATEWAY_URL === 'http://voice-gateway:3000') {
    logStructuredEvent('WA_VOICE_GATEWAY_NOT_CONFIGURED', {
      callId,
      correlationId,
      configuredUrl: VOICE_GATEWAY_URL,
    }, 'error');
    
    // Send a text message to inform user
    try {
      const messageUrl = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
      await fetch(messageUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fromNumber,
          type: 'text',
          text: {
            body: '📞 Voice calls are temporarily unavailable. Please send a text message instead, and our AI assistant will help you right away!'
          }
        }),
      });
      
      logStructuredEvent('WA_VOICE_FALLBACK_MESSAGE_SENT', { callId, to: fromNumber.slice(-4), correlationId });
    } catch (msgError) {
      logStructuredEvent('WA_VOICE_FALLBACK_MESSAGE_FAILED', {
        callId,
        error: msgError instanceof Error ? msgError.message : String(msgError),
        correlationId,
      }, 'error');
    }
    
    // Store the call attempt for later follow-up (mask phone number for privacy)
    await supabase.from('call_summaries').insert({
      call_id: callId,
      profile_id: profile?.user_id,
      primary_intent: 'voice_call_failed',
      summary_text: 'Voice call attempted but Voice Gateway not configured',
      metadata: { from_last4: fromNumber.slice(-4), reason: 'gateway_not_configured' },
    });
    
    return; // Exit early - don't try to connect to unavailable gateway
  }

  let voiceGatewayResponse;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      voiceGatewayResponse = await fetch(`${VOICE_GATEWAY_URL}/calls/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Correlation-ID': correlationId,
          'X-Retry-Count': String(attempt),
        },
        body: JSON.stringify({
          provider_call_id: callId,
          from_number: fromNumber,
          to_number: toNumber,
          agent_id: 'call_center',
          direction: 'inbound',
          language: language === 'fr' ? 'fr-FR' : language === 'rw' ? 'rw-RW' : 'en-US',
          voice_style: 'alloy',
          system_prompt: `You are EasyMO Call Center AI speaking with ${userName}. Keep responses SHORT (1-2 sentences). You handle: Rides, Real Estate, Jobs, Business, Insurance, Legal, Pharmacy, Wallet, Payments. Be warm and helpful.`,
          metadata: { 
            platform: 'whatsapp', 
            whatsapp_call_id: callId, 
            user_id: profile?.user_id,
            retry_count: attempt,
          },
        }),
      });
      
      if (voiceGatewayResponse.ok) {
        break; // Success, exit retry loop
      }
      
      // Log non-success response
      logStructuredEvent('WA_VOICE_GATEWAY_NON_OK_RESPONSE', {
        callId,
        attempt,
        status: voiceGatewayResponse.status,
        correlationId,
      }, attempt === maxRetries ? 'error' : 'warn');
      
      // Wait before retry (but not after last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Exponential backoff
      }
    } catch (fetchError) {
      logStructuredEvent('WA_VOICE_GATEWAY_FETCH_ERROR', {
        callId,
        attempt,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        correlationId,
      }, attempt === maxRetries ? 'error' : 'warn');
      
      // If this was the last attempt, re-throw the error
      if (attempt === maxRetries) {
        throw fetchError;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  if (!voiceGatewayResponse || !voiceGatewayResponse.ok) {
    const errorText = voiceGatewayResponse ? await voiceGatewayResponse.text().catch(() => 'Unable to read error response') : 'No response';
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'voice_gateway_response',
      callId,
      status: voiceGatewayResponse?.status,
      statusText: voiceGatewayResponse?.statusText,
      error: errorText,
      correlationId,
    }, 'error');
    throw new Error(`Voice Gateway failed: ${voiceGatewayResponse?.status ?? 'NO_RESPONSE'} ${voiceGatewayResponse?.statusText ?? ''}`);
  }

  const voiceSession = await voiceGatewayResponse.json();

  logStructuredEvent('WA_VOICE_CALL_SESSION_CREATED', {
    callId,
    sessionId: voiceSession.call_id,
    from: fromNumber.slice(-4),
    correlationId,
  });

  // Stage 3: Store call summary
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'store_call_summary',
    callId,
    correlationId,
  });

  const { error: insertError } = await supabase.from('call_summaries').insert({
    call_id: callId,
    profile_id: profile?.user_id,
    primary_intent: 'voice_call',
    summary_text: 'WhatsApp voice call initiated',
    raw_transcript_reference: voiceSession.call_id,
  });

  if (insertError) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'store_call_summary',
      callId,
      error: insertError.message,
      correlationId,
    }, 'warn');
    // Non-fatal: continue with call answering
  }

  // Stage 4: Answer call via WhatsApp API
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'whatsapp_answer',
    callId,
    hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
    hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
    correlationId,
  });

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'whatsapp_answer',
      callId,
      error: 'Missing WhatsApp API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)',
      correlationId,
    }, 'error');
    throw new Error('Missing WhatsApp API credentials');
  }

  const answerUrl = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls/${callId}/answer`;
  let answerResponse;
  try {
    answerResponse = await fetch(answerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answer: true, audio_url: voiceSession.websocket_url }),
    });
  } catch (answerError) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'whatsapp_answer_fetch',
      callId,
      error: answerError instanceof Error ? answerError.message : 'WhatsApp API connection failed',
      correlationId,
    }, 'error');
    throw answerError;
  }

  if (!answerResponse.ok) {
    const errorText = await answerResponse.text().catch(() => 'Unable to read error response');
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'whatsapp_answer_response',
      callId,
      status: answerResponse.status,
      error: errorText,
      correlationId,
    }, 'error');
    throw new Error(`WhatsApp API failed to answer call: ${answerResponse.status}`);
  }

  logStructuredEvent('WA_VOICE_CALL_ANSWERED', { 
    callId, 
    correlationId,
  });
}

async function handleCallEnded(callId: string, correlationId: string): Promise<void> {
  logStructuredEvent('WA_VOICE_CALL_ENDING', {
    callId,
    correlationId,
  });

  try {
    const response = await fetch(`${VOICE_GATEWAY_URL}/calls/${callId}/end`, {
      method: 'POST',
      headers: { 'X-Correlation-ID': correlationId },
    });

    if (!response.ok) {
      logStructuredEvent('WA_VOICE_ERROR', {
        stage: 'call_end',
        callId,
        status: response.status,
        error: `Voice Gateway returned ${response.status}`,
        correlationId,
      }, 'warn');
    }

    logStructuredEvent('WA_VOICE_CALL_ENDED', { callId, correlationId });
  } catch (error) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'call_end',
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
  }
}
