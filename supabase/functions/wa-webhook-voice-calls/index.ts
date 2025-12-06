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

// NO DUPLICATES - single declaration with fallbacks
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_ORG_ID = Deno.env.get('OPENAI_ORG_ID') ?? '';
const OPENAI_REALTIME_MODEL = Deno.env.get('OPENAI_REALTIME_MODEL') ?? 'gpt-5-realtime';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';

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

  // Stage 2: Build system prompt
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'build_system_prompt',
    callId,
    correlationId,
  });

  // System prompt - COMPLETE (not truncated)
  const systemPrompt = `You are EasyMO Call Center AI speaking with ${userName}. 

IMPORTANT RULES FOR VOICE CALLS:
- Keep responses SHORT (1-2 sentences maximum)
- Speak naturally as if on a phone call
- Be warm, friendly, and helpful
- Ask clarifying questions if needed
- If the caller speaks Kinyarwanda or French, respond in that language

SERVICES YOU CAN HELP WITH:
- Rides & Transportation (taxi, moto, shuttle booking)
- Real Estate (buy, sell, rent properties)
- Jobs (find work, post job listings)
- Business Services (registration, consulting)
- Insurance (health, vehicle, property quotes)
- Legal Services (contracts, disputes, advice)
- Pharmacy & Health (find medicines, nearby clinics)
- Farmer Services (inputs, market prices, weather)
- Wallet & Payments (balance, transfers, history)

Start by greeting the caller warmly and asking how you can help.`;

  // Stage 3: Create OpenAI Realtime session
  logStructuredEvent('WA_VOICE_STAGE', {
    stage: 'create_openai_session',
    callId,
    model: OPENAI_REALTIME_MODEL,
    correlationId,
  });

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_REALTIME_MODEL,
        voice: 'alloy',
        instructions: systemPrompt,
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI session creation failed: ${response.status} ${errorText}`);
    }

    const session = await response.json();

    logStructuredEvent('WA_VOICE_SESSION_CREATED', {
      callId,
      sessionId: session.id,
      model: OPENAI_REALTIME_MODEL,
      fromMasked: maskPhone(fromNumber),
      correlationId,
    });

    // Stage 4: Store call summary
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

    logStructuredEvent('WA_VOICE_CALL_ANSWERED', { 
      callId,
      sessionId: session.id,
      correlationId,
    });

    // Return the ephemeral session key for WhatsApp to connect to OpenAI Realtime API
    return {
      audio: {
        url: session.client_secret.value,
      },
    };

  } catch (error) {
    logStructuredEvent('WA_VOICE_ERROR', {
      stage: 'openai_session_creation',
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
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

    throw error;
  }
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
