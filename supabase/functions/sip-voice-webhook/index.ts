/**
 * Universal SIP Voice Webhook
 * 
 * Plug-and-play handler for ANY SIP provider:
 * - Twilio
 * - MTN Rwanda
 * - GO Malta  
 * - Any generic SIP trunk
 * 
 * Auto-detects provider and adapts to their format
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { logStructuredEvent } from '../_shared/observability.ts';

const VOICE_GATEWAY_URL = Deno.env.get('VOICE_GATEWAY_URL') || 'ws://voice-gateway:3002';
const SIP_PROVIDER = Deno.env.get('SIP_PROVIDER') || 'auto';

// Provider configurations
const PROVIDERS = {
  twilio: {
    name: 'Twilio',
    authToken: Deno.env.get('TWILIO_AUTH_TOKEN'),
    verifySignature: true,
  },
  mtn: {
    name: 'MTN Rwanda',
    username: Deno.env.get('MTN_SIP_USERNAME'),
    password: Deno.env.get('MTN_SIP_PASSWORD'),
    domain: Deno.env.get('MTN_SIP_DOMAIN') || 'sip.mtn.rw',
  },
  go_malta: {
    name: 'GO Malta',
    username: Deno.env.get('GO_SIP_USERNAME'),
    password: Deno.env.get('GO_SIP_PASSWORD'),
    domain: Deno.env.get('GO_SIP_DOMAIN') || 'sip.go.com.mt',
  },
  generic: {
    name: 'Generic SIP',
    username: Deno.env.get('SIP_USERNAME'),
    password: Deno.env.get('SIP_PASSWORD'),
    domain: Deno.env.get('SIP_DOMAIN'),
  },
};

/**
 * Auto-detect SIP provider from request
 */
function detectProvider(req: Request): string {
  const userAgent = req.headers.get('User-Agent') || '';
  
  if (userAgent.includes('TwilioProxy') || req.headers.get('X-Twilio-Signature')) {
    return 'twilio';
  }
  
  const origin = req.headers.get('Origin') || '';
  if (origin.includes('mtn.rw')) {
    return 'mtn';
  }
  
  if (origin.includes('go.com.mt')) {
    return 'go_malta';
  }
  
  // Check configured provider
  if (SIP_PROVIDER !== 'auto') {
    return SIP_PROVIDER;
  }
  
  return 'generic';
}

/**
 * Parse call parameters based on provider
 */
async function parseCallParams(req: Request, provider: string): Promise<any> {
  const contentType = req.headers.get('Content-Type') || '';
  
  if (contentType.includes('application/x-www-form-urlencoded')) {
    // Twilio, MTN, GO - typically use form data
    const formData = await req.formData();
    const params: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }
    
    return params;
  } else if (contentType.includes('application/json')) {
    // Some providers use JSON
    return await req.json();
  }
  
  return {};
}

/**
 * Extract call details based on provider format
 */
function extractCallDetails(params: any, provider: string): {
  callId: string;
  from: string;
  to: string;
  status?: string;
} {
  switch (provider) {
    case 'twilio':
      return {
        callId: params.CallSid || crypto.randomUUID(),
        from: params.From || params.Caller || 'unknown',
        to: params.To || params.Called || 'unknown',
        status: params.CallStatus,
      };
      
    case 'mtn':
      return {
        callId: params.call_id || params.session_id || crypto.randomUUID(),
        from: params.caller_number || params.from || 'unknown',
        to: params.called_number || params.to || 'unknown',
        status: params.call_status || params.status,
      };
      
    case 'go_malta':
      return {
        callId: params.call_uuid || params.session_id || crypto.randomUUID(),
        from: params.calling_number || params.from || 'unknown',
        to: params.destination_number || params.to || 'unknown',
        status: params.state || params.status,
      };
      
    default:
      // Generic SIP - try common field names
      return {
        callId: params.callId || params.call_id || params.sessionId || crypto.randomUUID(),
        from: params.from || params.caller || params.fromNumber || 'unknown',
        to: params.to || params.called || params.toNumber || 'unknown',
        status: params.status || params.callStatus || params.state,
      };
  }
}

/**
 * Generate TwiML/XML response based on provider
 */
function generateVoiceResponse(provider: string, callId: string, streamUrl: string): string {
  const wsUrl = streamUrl.replace('http', 'ws');
  
  switch (provider) {
    case 'twilio':
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Welcome to EasyMO. Connecting you to our AI assistant.</Say>
  <Connect>
    <Stream url="${wsUrl}/stream/${callId}" />
  </Connect>
</Response>`;
      
    case 'mtn':
      // MTN Rwanda typically uses similar XML format
      return `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <say language="en-US">Welcome to EasyMO. Connecting you to our AI assistant.</say>
  <connect>
    <stream url="${wsUrl}/stream/${callId}" />
  </connect>
</response>`;
      
    case 'go_malta':
      // GO Malta format (may vary - adjust based on their docs)
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://easymo.com/audio/welcome.mp3</Play>
  <Redirect>${wsUrl}/stream/${callId}</Redirect>
</Response>`;
      
    default:
      // Generic XML response
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Welcome to EasyMO.</Say>
  <Stream>${wsUrl}/stream/${callId}</Stream>
</Response>`;
  }
}

/**
 * Main webhook handler
 */
serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Request-ID') || crypto.randomUUID();

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'sip-voice-webhook',
      timestamp: new Date().toISOString(),
      provider: SIP_PROVIDER,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Incoming voice call
  if (url.pathname === '/voice' && req.method === 'POST') {
    try {
      // Auto-detect provider
      const provider = detectProvider(req);
      
      await logStructuredEvent('sip.webhook.request', {
        correlationId,
        provider,
        userAgent: req.headers.get('User-Agent'),
      });

      // Parse call parameters
      const params = await parseCallParams(req, provider);
      const callDetails = extractCallDetails(params, provider);

      await logStructuredEvent('sip.call.incoming', {
        correlationId,
        provider,
        callId: callDetails.callId,
        from: callDetails.from?.slice(-4),
        to: callDetails.to,
        status: callDetails.status,
      });

      // Generate appropriate response
      const voiceResponse = generateVoiceResponse(
        provider,
        callDetails.callId,
        VOICE_GATEWAY_URL
      );

      return new Response(voiceResponse, {
        headers: {
          'Content-Type': 'text/xml',
          'X-Request-ID': correlationId,
          'X-Provider': provider,
        },
      });
    } catch (error) {
      await logStructuredEvent('sip.webhook.error', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      // Generic error response
      const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">We're sorry, but we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup />
</Response>`;

      return new Response(errorResponse, {
        status: 500,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
  }

  // Call status callback (all providers)
  if (url.pathname === '/status' && req.method === 'POST') {
    try {
      const provider = detectProvider(req);
      const params = await parseCallParams(req, provider);
      const callDetails = extractCallDetails(params, provider);

      await logStructuredEvent('sip.call.status', {
        correlationId,
        provider,
        callId: callDetails.callId,
        status: callDetails.status,
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Status callback error:', error);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Not found', { status: 404 });
});
