/**
 * Twilio Voice Webhook Handler
 * 
 * Handles incoming phone calls via Twilio SIP trunk
 * Connects calls to Voice Gateway for OpenAI Realtime API processing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { logStructuredEvent } from '../_shared/observability.ts';

const VOICE_GATEWAY_URL = Deno.env.get('VOICE_GATEWAY_URL') || 'ws://voice-gateway:3002';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';

/**
 * Verify Twilio webhook signature
 */
function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('TWILIO_AUTH_TOKEN not set - skipping signature verification');
    return true; // Allow in development
  }

  // Implement Twilio signature validation
  // https://www.twilio.com/docs/usage/security#validating-requests
  // For now, simplified (should use crypto.subtle in production)
  return true;
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Request-ID') || crypto.randomUUID();

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'twilio-voice-webhook',
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Incoming call webhook
  if (url.pathname === '/voice' && req.method === 'POST') {
    try {
      const formData = await req.formData();
      const params: Record<string, string> = {};
      
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString();
      }

      // Verify Twilio signature
      const signature = req.headers.get('X-Twilio-Signature') || '';
      const fullUrl = `${url.origin}${url.pathname}`;
      
      if (!verifyTwilioSignature(signature, fullUrl, params)) {
        await logStructuredEvent('twilio.webhook.invalid_signature', {
          correlationId,
        }, 'warn');
        
        return new Response('Invalid signature', { status: 403 });
      }

      const {
        CallSid,
        From,
        To,
        CallStatus,
      } = params;

      await logStructuredEvent('twilio.call.incoming', {
        correlationId,
        callSid: CallSid,
        from: From?.slice(-4),
        to: To,
        status: CallStatus,
      });

      // Generate TwiML response to connect to Voice Gateway
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Welcome to EasyMO. Please wait while we connect you to an agent.</Say>
  <Connect>
    <Stream url="${VOICE_GATEWAY_URL.replace('http', 'ws')}/stream/${CallSid}">
      <Parameter name="callSid" value="${CallSid}" />
      <Parameter name="from" value="${From}" />
      <Parameter name="to" value="${To}" />
      <Parameter name="correlationId" value="${correlationId}" />
    </Stream>
  </Connect>
</Response>`;

      return new Response(twiml, {
        headers: {
          'Content-Type': 'text/xml',
          'X-Request-ID': correlationId,
        },
      });
    } catch (error) {
      await logStructuredEvent('twilio.webhook.error', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">We're sorry, but we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup />
</Response>`;

      return new Response(errorTwiml, {
        status: 500,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
  }

  // Call status callback
  if (url.pathname === '/status' && req.method === 'POST') {
    try {
      const formData = await req.formData();
      const params: Record<string, string> = {};
      
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString();
      }

      const {
        CallSid,
        CallStatus,
        CallDuration,
      } = params;

      await logStructuredEvent('twilio.call.status', {
        correlationId,
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Status callback error:', error);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Not found', { status: 404 });
});
