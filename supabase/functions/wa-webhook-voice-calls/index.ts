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

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();

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
    if (mode === 'subscribe' && token === Deno.env.get('WA_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return respond({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? Deno.env.get('WA_APP_SECRET');
    
    if (signature && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) return respond({ error: 'invalid_signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const call = payload?.entry?.[0]?.changes?.[0]?.value?.call;
    
    if (!call) return respond({ success: true, message: 'not_a_call_event' });

    const { event: callEvent, id: callId, from: fromNumber, to: toNumber } = call;

    await logStructuredEvent('WA_VOICE_CALL_EVENT', {
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
        await logStructuredEvent('WA_VOICE_CALL_ACCEPTED', { callId, correlationId });
        break;
      case 'rejected':
      case 'ended':
        await handleCallEnded(callId, correlationId);
        break;
    }

    return respond({ success: true, call_id: callId, event: callEvent });

  } catch (error) {
    await logStructuredEvent('WA_VOICE_WEBHOOK_ERROR', {
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
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, name, preferred_language')
      .eq('whatsapp_number', fromNumber)
      .single();

    const language = profile?.preferred_language ?? 'en';
    const userName = profile?.name ?? 'there';

    const voiceGatewayResponse = await fetch(`${VOICE_GATEWAY_URL}/calls/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
      body: JSON.stringify({
        provider_call_id: callId,
        from_number: fromNumber,
        to_number: toNumber,
        agent_id: 'call_center',
        direction: 'inbound',
        language: language === 'fr' ? 'fr-FR' : 'en-US',
        voice_style: 'alloy',
        system_prompt: `You are EasyMO Call Center AI speaking with ${userName}. Keep responses SHORT (1-2 sentences). You handle: Rides, Real Estate, Jobs, Business, Insurance, Legal, Pharmacy, Wallet, Payments. Be warm and helpful.`,
        metadata: { platform: 'whatsapp', whatsapp_call_id: callId, user_id: profile?.user_id },
      }),
    });

    if (!voiceGatewayResponse.ok) {
      throw new Error(`Voice Gateway failed: ${voiceGatewayResponse.statusText}`);
    }

    const voiceSession = await voiceGatewayResponse.json();

    await logStructuredEvent('WA_VOICE_CALL_SESSION_CREATED', {
      callId,
      sessionId: voiceSession.call_id,
      from: fromNumber.slice(-4),
      correlationId,
    });

    await supabase.from('call_summaries').insert({
      call_id: callId,
      profile_id: profile?.user_id,
      primary_intent: 'voice_call',
      summary_text: 'WhatsApp voice call initiated',
      raw_transcript_reference: voiceSession.call_id,
    });

    await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls/${callId}/answer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer: true, audio_url: voiceSession.websocket_url }),
      }
    );

    await logStructuredEvent('WA_VOICE_CALL_ANSWERED', { callId, correlationId });

  } catch (error) {
    await logStructuredEvent('WA_VOICE_CALL_SETUP_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
  }
}

async function handleCallEnded(callId: string, correlationId: string): Promise<void> {
  try {
    await fetch(`${VOICE_GATEWAY_URL}/calls/${callId}/end`, {
      method: 'POST',
      headers: { 'X-Correlation-ID': correlationId },
    });
    await logStructuredEvent('WA_VOICE_CALL_ENDED', { callId, correlationId });
  } catch (error) {
    await logStructuredEvent('WA_VOICE_CALL_END_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
  }
}
