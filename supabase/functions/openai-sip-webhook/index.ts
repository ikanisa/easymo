/**
 * OpenAI SIP Webhook Handler
 * 
 * Receives incoming call events from OpenAI SIP Realtime API.
 * When a phone call comes in via SIP trunk (MTN Rwanda, GO Malta),
 * OpenAI routes it to this webhook for accept/reject decisions.
 * 
 * Configuration (set in Supabase):
 * - Organization ID: org-4Kr7lOqpDhJErYgyGzwgSduN
 * - Project ID: proj_BL7HHgepm76lhElLqmfOckIU
 * - Webhook Secret: whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=
 * - SIP URI: sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_REALTIME_MODEL = Deno.env.get('OPENAI_REALTIME_MODEL') ?? 'gpt-5-realtime';
const WEBHOOK_SECRET = Deno.env.get('OPENAI_WEBHOOK_SECRET') ?? '';

/**
 * Build system prompt based on caller profile
 */
function buildSystemPrompt(userName: string): string {
  return `You are EasyMO Call Center AI speaking with ${userName}.

IMPORTANT RULES FOR PHONE CALLS:
- Keep responses SHORT (1-2 sentences maximum)
- Speak naturally as if on a phone call
- Be warm, friendly, and helpful
- Ask clarifying questions if needed
- Detect language and respond in the caller's language (English, French, Kinyarwanda, Swahili)

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
}

/**
 * Verify webhook signature from OpenAI
 */
async function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === `sha256=${expectedSignature}`;
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();

  logStructuredEvent('OPENAI_SIP_WEBHOOK_REQUEST', {
    method: req.method,
    path: url.pathname,
    correlationId,
  });

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Correlation-ID', correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
    return respond({
      status: 'healthy',
      service: 'openai-sip-webhook',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const rawBody = await req.text();
    
    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const signature = req.headers.get('x-openai-signature');
      const isValid = await verifySignature(rawBody, signature, WEBHOOK_SECRET);
      
      if (!isValid) {
        logStructuredEvent('OPENAI_SIP_WEBHOOK_ERROR', {
          error: 'Invalid webhook signature',
          correlationId,
        }, 'error');
        return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      logStructuredEvent('OPENAI_SIP_WEBHOOK_ERROR', {
        error: 'JSON parse failed',
        correlationId,
      }, 'error');
      return respond({ error: 'invalid_json' }, { status: 400 });
    }

    logStructuredEvent('OPENAI_SIP_WEBHOOK_EVENT', {
      type: event.type,
      callId: event.data?.call_id,
      correlationId,
    });

    // Handle realtime.call.incoming event
    if (event.type === 'realtime.call.incoming') {
      const callId = event.data.call_id;
      const fromNumber = event.data.from;
      const toNumber = event.data.to;

      logStructuredEvent('OPENAI_SIP_CALL_INCOMING', {
        callId,
        from: fromNumber?.slice(-4),
        to: toNumber?.slice(-4),
        correlationId,
      });

      // Lookup caller profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, name, preferred_language')
        .or(`phone_number.eq.${fromNumber},wa_id.eq.${fromNumber}`)
        .maybeSingle();

      const userName = profile?.name ?? 'there';

      // Accept the call with GPT-5 Realtime
      try {
        const acceptResponse = await fetch(`https://api.openai.com/v1/realtime/calls/${callId}/accept`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'realtime',
            model: OPENAI_REALTIME_MODEL, // MANDATORY: gpt-5-realtime
            voice: 'alloy',
            instructions: buildSystemPrompt(userName),
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

        if (!acceptResponse.ok) {
          const errorText = await acceptResponse.text();
          throw new Error(`Failed to accept call: ${acceptResponse.status} ${errorText}`);
        }

        const acceptData = await acceptResponse.json();

        logStructuredEvent('OPENAI_SIP_CALL_ACCEPTED', {
          callId,
          sessionId: acceptData.session_id,
          model: OPENAI_REALTIME_MODEL,
          correlationId,
        });

        // Store call summary
        await supabase.from('call_summaries').insert({
          call_id: callId,
          profile_id: profile?.user_id,
          primary_intent: 'phone_call',
          summary_text: 'Phone call via SIP trunk initiated',
          raw_transcript_reference: callId,
          metadata: {
            from: fromNumber?.slice(-4),
            to: toNumber?.slice(-4),
            session_id: acceptData.session_id,
          },
        });

        return respond({
          success: true,
          call_id: callId,
          session_id: acceptData.session_id,
        });

      } catch (error) {
        logStructuredEvent('OPENAI_SIP_CALL_ACCEPT_ERROR', {
          callId,
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        }, 'error');

        // Reject the call
        await fetch(`https://api.openai.com/v1/realtime/calls/${callId}/reject`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        return respond({
          success: false,
          error: 'call_accept_failed',
        }, { status: 500 });
      }
    }

    // Handle other event types (call.ended, etc.)
    if (event.type === 'realtime.call.ended') {
      const callId = event.data.call_id;
      
      logStructuredEvent('OPENAI_SIP_CALL_ENDED', {
        callId,
        duration: event.data.duration,
        correlationId,
      });

      // Update call summary
      await supabase
        .from('call_summaries')
        .update({
          summary_text: 'Phone call ended',
          updated_at: new Date().toISOString(),
        })
        .eq('call_id', callId);

      return respond({ success: true, call_id: callId });
    }

    // Unknown event type
    return respond({
      success: true,
      message: 'event_received',
      event_type: event.type,
    });

  } catch (error) {
    logStructuredEvent('OPENAI_SIP_WEBHOOK_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});
