/**
 * WhatsApp Cloud API Voice Calls Handler
 * 
 * Implements WhatsApp Business Platform Calling API with WebRTC
 * Based on: https://developers.facebook.com/docs/whatsapp/business-platform/webhooks/components/calls
 * 
 * Flow:
 * 1. Receive "connect" webhook with SDP offer
 * 2. Pre-accept call with SDP answer
 * 3. Establish WebRTC connection
 * 4. Accept call and start media flow
 * 5. Bridge audio to OpenAI Realtime API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';
import { createWebRTCBridge } from './webrtc-bridge.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Configuration
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';
const WA_VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_ORG_ID = Deno.env.get('OPENAI_ORG_ID') ?? '';
const OPENAI_REALTIME_MODEL = Deno.env.get('OPENAI_REALTIME_MODEL') ?? 'gpt-4o-realtime-preview';
const WEBRTC_BRIDGE_URL = Deno.env.get('VOICE_BRIDGE_URL') ?? Deno.env.get('WEBRTC_BRIDGE_URL') ?? 'http://localhost:8080';

// Types based on WhatsApp API documentation
interface CallWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        calls?: Array<{
          id: string;
          from: string;
          to: string;
          event: 'connect' | 'terminate';
          timestamp: string;
          direction?: string;
          session?: {
            sdp_type: 'offer' | 'answer';
            sdp: string;
          };
          status?: string;
          start_time?: string;
          end_time?: string;
          duration?: number;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
/**
 * Call WhatsApp API to pre-accept the call
 */
async function preAcceptCall(callId: string, sdpAnswer: string, correlationId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: callId,
          action: 'pre_accept',
          session: {
            sdp_type: 'answer',
            sdp: sdpAnswer,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logStructuredEvent('WA_CALL_PRE_ACCEPT_FAILED', {
        callId,
        status: response.status,
        error,
        correlationId,
      }, 'error');
      return false;
    }

    logStructuredEvent('WA_CALL_PRE_ACCEPTED', { callId, correlationId });
    return true;
  } catch (error) {
    logStructuredEvent('WA_CALL_PRE_ACCEPT_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return false;
  }
}

/**
 * Call WhatsApp API to accept the call
 */
async function acceptCall(callId: string, sdpAnswer: string, correlationId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: callId,
          action: 'accept',
          session: {
            sdp_type: 'answer',
            sdp: sdpAnswer,
          },
          biz_opaque_callback_data: correlationId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logStructuredEvent('WA_CALL_ACCEPT_FAILED', {
        callId,
        status: response.status,
        error,
        correlationId,
      }, 'error');
      return false;
    }

    logStructuredEvent('WA_CALL_ACCEPTED', { callId, correlationId });
    return true;
  } catch (error) {
    logStructuredEvent('WA_CALL_ACCEPT_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return false;
  }
}

/**
 * Handle incoming call from WhatsApp user
 */
async function handleCallConnect(call: any, correlationId: string): Promise<void> {
  const { id: callId, from: fromNumber, to: toNumber, session } = call;
  
  logStructuredEvent('WA_CALL_CONNECT', {
    callId,
    from: fromNumber,
    to: toNumber,
    hasSDP: !!session?.sdp,
    correlationId,
  });

  if (!session?.sdp) {
    logStructuredEvent('WA_CALL_NO_SDP', { callId, correlationId }, 'error');
    return;
  }

  // Get user profile for personalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, preferred_language')
    .eq('phone_number', fromNumber)
    .maybeSingle();

  const userName = profile?.first_name || 'there';
  const language = profile?.preferred_language || 'en';
  const voice = language === 'fr' ? 'shimmer' : 'alloy';

  // Build system instructions for OpenAI
  const systemInstructions = `You are EasyMO Call Center AI speaking with ${userName}.
Keep responses SHORT (1-2 sentences max for voice calls).
You help with: Rides, Real Estate, Jobs, Business, Insurance, Legal, Pharmacy, Farmer Services, Wallet & Payments.
Be friendly, helpful, and concise. Ask clarifying questions if needed.
Speak naturally as if on a phone call in ${language === 'fr' ? 'French' : language === 'rw' ? 'Kinyarwanda' : 'English'}.`;

  // Step 1: Create WebRTC bridge session
  let sdpAnswer: string;
  let sessionId: string;
  
  try {
    const bridgeResponse = await fetch(
      `${WEBRTC_BRIDGE_URL}/api/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          sdpOffer: session.sdp,
          from: fromNumber,
          config: {
            voice,
            instructions: systemInstructions,
            model: OPENAI_REALTIME_MODEL,
          },
        }),
      }
    );

    if (!bridgeResponse.ok) {
      throw new Error(`WebRTC bridge error: ${bridgeResponse.status}`);
    }

    const result = await bridgeResponse.json();
    sdpAnswer = result.sdpAnswer;
    sessionId = result.callId;
    
    logStructuredEvent('WA_WEBRTC_BRIDGE_CREATED', {
      callId,
      sessionId,
      correlationId,
    });
  } catch (error) {
    logStructuredEvent('WA_WEBRTC_BRIDGE_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return;
  }

  // Step 2: Pre-accept the call (recommended by WhatsApp for faster connection)
  const preAccepted = await preAcceptCall(callId, sdpAnswer, correlationId);
  
  if (!preAccepted) {
    logStructuredEvent('WA_CALL_PRE_ACCEPT_SKIP', { callId, correlationId }, 'warn');
  }

  // Store call summary
  await supabase.from('call_summaries').insert({
    call_id: callId,
    profile_id: profile?.user_id,
    phone_number: fromNumber,
    call_type: 'whatsapp_voice',
    status: 'ringing',
    language,
    metadata: {
      correlation_id: correlationId,
      user_name: userName,
      openai_session_id: sessionId,
    },
  });

  // Step 3: Accept the call (after WebRTC connection is ready)
  setTimeout(async () => {
    try {
      const accepted = await acceptCall(callId, sdpAnswer, correlationId);

      if (accepted) {
        logStructuredEvent('WA_CALL_FULLY_CONNECTED', {
          callId,
          sessionId,
          correlationId,
        });
      }
    } catch (error) {
      logStructuredEvent('WA_CALL_ACCEPT_DELAYED_ERROR', {
        callId,
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      }, 'error');
    }
  }, 1000); // Wait 1 second for WebRTC connection to establish
}

/**
 * Handle call termination
 */
async function handleCallTerminate(call: any, correlationId: string): Promise<void> {
  const { id: callId, status, duration } = call;
  
  logStructuredEvent('WA_CALL_TERMINATE', {
    callId,
    status,
    duration,
    correlationId,
  });

  // Notify WebRTC bridge to stop session
  try {
    await fetch(`${WEBRTC_BRIDGE_URL}/bridge/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId }),
    });
  } catch (error) {
    logStructuredEvent('WA_WEBRTC_BRIDGE_STOP_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'warn');
  }

  // Update call summary
  await supabase
    .from('call_summaries')
    .update({
      status: 'completed',
      duration,
      summary_text: `Call ${status} - Duration: ${duration || 0}s`,
    })
    .eq('call_id', callId);

  // Trigger post-call notification to send summary via WhatsApp AND SMS
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    await fetch(`${SUPABASE_URL}/functions/v1/post-call-notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_id: callId,
        phone_number: call.from,
      }),
    });

    logStructuredEvent('POST_CALL_NOTIFY_TRIGGERED', {
      callId,
      correlationId,
    });
  } catch (error) {
    logStructuredEvent('POST_CALL_NOTIFY_TRIGGER_ERROR', {
      callId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'warn');
  }
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  logStructuredEvent('WA_VOICE_WEBHOOK_RECEIVED', {
    method: req.method,
    correlationId,
  });

  // Handle webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
      logStructuredEvent('WA_VOICE_WEBHOOK_VERIFIED', { correlationId });
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const payload: CallWebhook = await req.json();

    // Extract calls from webhook
    const calls = payload?.entry?.[0]?.changes?.[0]?.value?.calls;

    if (!calls || calls.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'no_calls' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const call = calls[0];

    logStructuredEvent('WA_CALL_EVENT', {
      event: call.event,
      callId: call.id,
      from: call.from,
      correlationId,
    });

    // Handle different call events
    switch (call.event) {
      case 'connect':
        await handleCallConnect(call, correlationId);
        break;
      
      case 'terminate':
        await handleCallTerminate(call, correlationId);
        break;
      
      default:
        logStructuredEvent('WA_CALL_UNKNOWN_EVENT', {
          event: call.event,
          callId: call.id,
          correlationId,
        }, 'warn');
    }

    return new Response(JSON.stringify({ success: true, call_id: call.id }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStructuredEvent('WA_VOICE_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');

    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
