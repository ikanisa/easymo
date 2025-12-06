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

const OPENAI_REALTIME_WS_URL = Deno.env.get('OPENAI_REALTIME_WS_URL') ?? 'wss://api.openai.com/v1/realtime';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';

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
    from: fromNumber?.slice(-4),
    correlationId,
  });

  // Stage 1: Profile lookup
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'profile_lookup',
    callId,
    correlationId,
  });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, name, preferred_language')
    .eq('whatsapp_number', fromNumber)
    .single();

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
  const systemPrompt = `You are EasyMO Call Center AI speaking with ${userName}. Keep responses SHORT (1-2 sentences). You handle: Rides, Real Estate, Jobs, Business, Insurance, Legal, Pharmacy, Wallet, Payments. Be warm and helpful.`;
  
  const websocketUrl = `${OPENAI_REALTIME_WS_URL}?model=gpt-4o-realtime-preview-2024-12-17`;

  logStructuredEvent('WA_VOICE_WEBSOCKET_GENERATED', {
    callId,
    language: voiceLanguage,
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
