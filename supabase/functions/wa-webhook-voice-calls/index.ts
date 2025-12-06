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
const OPENAI_REALTIME_MODEL = Deno.env.get('OPENAI_REALTIME_MODEL') ?? 'gpt-5-realtime';

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
 * Generate a simple SDP answer for WhatsApp's SDP offer
 * This is a basic implementation - for production, use a proper WebRTC library
 */
function generateSDPAnswer(offer: string): string {
  // TODO: Implement proper SDP answer generation
  // For now, return a basic answer that matches WhatsApp's requirements
  
  // Extract session info from offer
  const lines = offer.split('\r\n');
  const audioMLine = lines.find(l => l.startsWith('m=audio'));
  const connectionLine = lines.find(l => l.startsWith('c='));
  
  // Basic SDP answer structure
  const answer = [
    'v=0',
    'o=- 0 0 IN IP4 0.0.0.0',
    's=EasyMO Call Center',
    't=0 0',
    connectionLine || 'c=IN IP4 0.0.0.0',
    audioMLine || 'm=audio 9 RTP/AVP 0 8 101',
    'a=rtpmap:0 PCMU/8000',
    'a=rtpmap:8 PCMA/8000',
    'a=rtpmap:101 telephone-event/8000',
    'a=sendrecv',
    'a=rtcp-mux',
  ].join('\r\n');
  
  return answer + '\r\n';
}

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

  // Generate SDP answer from WhatsApp's SDP offer
  const sdpAnswer = generateSDPAnswer(session.sdp);

  // Step 1: Pre-accept the call (recommended by WhatsApp for faster connection)
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
    },
  });

  // Step 2: Accept the call after WebRTC connection
  // In a full implementation, you would:
  // 1. Establish WebRTC connection using the SDP
  // 2. Wait for connection to be ready
  // 3. Then accept the call
  // For now, we accept immediately after pre-accept
  
  // Small delay to allow WebRTC connection setup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const accepted = await acceptCall(callId, sdpAnswer, correlationId);

  if (accepted) {
    // TODO: Start media bridge to OpenAI Realtime API
    // This requires:
    // 1. WebRTC media server to receive audio from WhatsApp
    // 2. Connect to OpenAI Realtime API WebSocket
    // 3. Forward audio between WhatsApp <-> OpenAI
    
    logStructuredEvent('WA_CALL_MEDIA_BRIDGE_NEEDED', {
      callId,
      note: 'Media bridging to OpenAI Realtime not yet implemented',
      correlationId,
    }, 'warn');
  }
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

  // Update call summary
  await supabase
    .from('call_summaries')
    .update({
      status: 'completed',
      duration,
      summary_text: `Call ${status} - Duration: ${duration || 0}s`,
    })
    .eq('call_id', callId);
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
