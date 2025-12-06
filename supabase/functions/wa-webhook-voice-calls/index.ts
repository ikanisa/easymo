/**
 * WhatsApp Voice Calls Handler
 * Handles real-time voice calls (NOT voice messages)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { isValidPhone, maskPhone } from '../_shared/phone-utils.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const OPENAI_REALTIME_WS_URL = Deno.env.get('OPENAI_REALTIME_WS_URL') ?? 'wss://api.openai.com/v1/realtime';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';
const VOICE_GATEWAY_URL = Deno.env.get('VOICE_GATEWAY_URL') ?? 'http://voice-gateway:3000';
const MAX_VOICE_RETRIES = Number(Deno.env.get('VOICE_GATEWAY_MAX_RETRIES') ?? '2');

// Validate environment variables at startup and log warnings
let envValidated = false;
function validateEnvironment(correlationId: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY is not configured');
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
      openaiConfigured: !!OPENAI_API_KEY,
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
    
    const calls = payload?.entry?.[0]?.changes?.[0]?.value?.calls;
    
    // Log parsing result (helpful for debugging non-call events)
    logStructuredEvent('WA_VOICE_PAYLOAD_PARSED', {
      hasEntry: !!payload?.entry,
      hasChanges: !!payload?.entry?.[0]?.changes,
      hasCalls: !!calls,
      callsCount: calls?.length || 0,
      correlationId,
    });
    
    if (!calls || calls.length === 0) {
      return respond({ success: true, message: 'not_a_call_event' });
    }

    const call = calls[0]; // Handle first call in array
    const { status: callEvent, id: callId, from: fromNumber, to: toNumber } = call;

    logStructuredEvent('WA_VOICE_CALL_EVENT', {
      callId,
      event: callEvent,
      from: fromNumber?.slice(-4),
      correlationId,
    });

    switch (callEvent) {
      case 'ringing':
        const audioConfig = await handleIncomingCall(callId, fromNumber, toNumber, correlationId);
        // Return audio stream configuration to WhatsApp
        return respond(audioConfig);
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
): Promise<{ audio: { url: string } }> {
  logStructuredEvent('WA_VOICE_CALL_HANDLING_START', {
    callId,
    from: maskPhone(fromNumber),
    correlationId,
  });

  // Validate phone number format using existing utility
  if (!fromNumber || !isValidPhone(fromNumber)) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'input_validation',
      callId,
      error: 'Invalid phone number format',
      correlationId,
    }, 'error');
    // Return a valid error response that WhatsApp can handle
    throw new Error('Invalid phone number format');
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

  // Stage 2: Generate ephemeral OpenAI Realtime WebSocket URL
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'openai_websocket_url_generation',
    callId,
    correlationId,
  });

  // Build WebSocket URL with API key and session config as query parameters
  const voiceLanguage = language === 'fr' ? 'fr' : 'en';
  const systemPrompt = `You are EasyMO Call Center AI speaking with ${userName}. Keep responses SHORT (1-2 sentences max for voice). You help with:
- Rides & Transportation (taxi, moto, shuttle)
- Real Estate (buy, sell, rent properties)
- Jobs (find work, post jobs)
- Business Services (registration, consulting)
- Insurance (health, vehicle, property)
- Legal Services (contracts, disputes)
- Pharmacy & Health (find medicines, clinics)
- Farmer Services (inputs, markets, weather)
- Wallet & Payments (balance, transfers)

Be friendly, helpful, and concise. Ask clarifying questions if needed. Speak naturally as if on a phone call.`;
  
  const websocketUrl = `${OPENAI_REALTIME_WS_URL}?model=gpt-4o-realtime-preview-2024-12-17`;
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
      
      logStructuredEvent('WA_VOICE_FALLBACK_MESSAGE_SENT', { callId, to: maskPhone(fromNumber), correlationId });
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
      metadata: { from_masked: maskPhone(fromNumber), reason: 'gateway_not_configured' },
    });
    
    return; // Exit early - don't try to connect to unavailable gateway
  }

  let voiceGatewayResponse;

  for (let attempt = 0; attempt <= MAX_VOICE_RETRIES; attempt++) {
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
          system_prompt: `You are EasyMO Call Center AI speaking with ${userName}. Keep responses SHORT (1-2 sentences max for voice). You help with:
- Rides & Transportation (taxi, moto, shuttle)
- Real Estate (buy, sell, rent properties)
- Jobs (find work, post jobs)
- Business Services (registration, consulting)
- Insurance (health, vehicle, property)
- Legal Services (contracts, disputes)
- Pharmacy & Health (find medicines, clinics)
- Farmer Services (inputs, markets, weather)
- Wallet & Payments (balance, transfers)

Be friendly, helpful, and concise. Ask clarifying questions if needed. Speak naturally as if on a phone call.`,
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
      }, attempt === MAX_VOICE_RETRIES ? 'error' : 'warn');
      
      // Wait before retry (but not after last attempt)
      if (attempt < MAX_VOICE_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Exponential backoff
      }
    } catch (fetchError) {
      logStructuredEvent('WA_VOICE_GATEWAY_FETCH_ERROR', {
        callId,
        attempt,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        correlationId,
      }, attempt === MAX_VOICE_RETRIES ? 'error' : 'warn');
      
      // If this was the last attempt, re-throw the error
      if (attempt === MAX_VOICE_RETRIES) {
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

  logStructuredEvent('WA_VOICE_WEBSOCKET_GENERATED', {
    callId,
    language: voiceLanguage,
    fromLast4: fromNumber.slice(-4),
    fromMasked: maskPhone(fromNumber),
    sessionId: voiceSession.call_id,
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
    raw_transcript_reference: callId,
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

  // Stage 4: Return audio stream configuration in webhook response
  // Per WhatsApp Cloud API Calling docs: respond to the webhook with audio config
  // NO separate API call needed - the webhook response itself contains the stream URL
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'prepare_audio_response',
    callId,
    websocketConfigured: true,
    correlationId,
  });

  logStructuredEvent('WA_VOICE_CALL_ANSWERED', { 
    callId,
    audioStreamUrl: 'OpenAI Realtime WebSocket',
    correlationId,
  });

  // Return the audio stream configuration to WhatsApp
  // This instructs WhatsApp to connect the call audio to the OpenAI Realtime API
  return {
    audio: {
      url: websocketUrl,
    },
  };
}

async function handleCallEnded(callId: string, correlationId: string): Promise<void> {
  logStructuredEvent('WA_VOICE_CALL_ENDED', {
    callId,
    correlationId,
  });

  // Update call summary with ended status
  const { error } = await supabase
    .from('call_summaries')
    .update({
      summary_text: 'WhatsApp voice call ended',
      updated_at: new Date().toISOString(),
    })
    .eq('call_id', callId);

  if (error) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'call_end_update',
      callId,
      error: error.message,
      correlationId,
    }, 'warn');
  }
}
