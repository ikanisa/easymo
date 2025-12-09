/**
 * WA-Agent-Call-Center - Universal AI Agent
 * 
 * The "master" agent that handles ALL inquiries:
 * - Knows everything about easyMO services
 * - Collaborates with specialized agents
 * - Perfect for voice calls
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CallCenterAgent } from './call-center-agent.ts';
import { CallCenterAGI } from './call-center-agi.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { logStructuredEvent } from '../_shared/observability.ts';
import { sendText } from '../_shared/wa-webhook-shared/wa/client.ts';
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
import { MessageDeduplicator } from '../_shared/message-deduplicator.ts';
import {
  downloadWhatsAppAudio,
  transcribeAudio,
  textToSpeech,
  uploadWhatsAppMedia,
} from '../_shared/voice-handler.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Use full AGI implementation (with tools) if enabled, otherwise use basic agent
const useAGI = Deno.env.get('CALL_CENTER_USE_AGI') !== 'false'; // Default to true
const agent = useAGI ? new CallCenterAGI() : new CallCenterAgent();
const deduplicator = new MessageDeduplicator(supabase);

// Voice Gateway URL validation
const VOICE_GATEWAY_URL = Deno.env.get('VOICE_GATEWAY_URL') ?? 'http://voice-gateway:3000';

// Validate environment variables on first request
let envValidated = false;
function validateEnvironment(correlationId: string): void {
  if (envValidated) return;
  
  const warnings: string[] = [];
  
  if (!VOICE_GATEWAY_URL || VOICE_GATEWAY_URL === 'http://voice-gateway:3000') {
    warnings.push('VOICE_GATEWAY_URL is not configured or using default Docker hostname');
  }
  
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN');
  if (!accessToken) {
    warnings.push('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID');
  if (!phoneNumberId) {
    warnings.push('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }
  
  if (warnings.length > 0) {
    logStructuredEvent('CALL_CENTER_ENV_WARNING', {
      warnings,
      correlationId,
    }, 'warn');
  }
  
  envValidated = true;
}

console.log(`Call Center initialized: ${useAGI ? 'AGI (Full Tools)' : 'Basic Agent'}`);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();
  
  // Entry-point logging - log immediately when request is received
  logStructuredEvent('CALL_CENTER_REQUEST_RECEIVED', {
    method: req.method,
    path: url.pathname,
    hasSignature: !!req.headers.get('x-hub-signature-256'),
    userAgent: req.headers.get('user-agent')?.slice(0, 50),
    correlationId,
    requestId,
  });

  // Validate environment variables on first request
  validateEnvironment(correlationId);
  
  // Check if this is an agent-to-agent consultation
  const isConsultation = req.headers.get('X-Agent-Consultation') === 'true';
  const sourceAgent = req.headers.get('X-Source-Agent');

  // Rate limiting
  const rateLimitCheck = await rateLimitMiddleware(req, { 
    limit: isConsultation ? 200 : 60, // Higher limit for agent consultations
    windowSeconds: 60 
  });
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-ID', requestId);
    headers.set('X-Correlation-ID', correlationId);
    headers.set('X-Service', 'wa-agent-call-center');
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
    return respond({
      status: 'healthy',
      service: 'wa-agent-call-center',
      agent: {
        type: agent.type,
        name: agent.name,
        description: agent.description,
      },
      capabilities: useAGI ? [
        'universal_knowledge',
        'agent_orchestration',
        'multi_language',
        'voice_optimized',
        'tool_execution',
        'knowledge_retrieval',
        'database_operations'
      ] : [
        'universal_knowledge',
        'agent_collaboration',
        'multi_language',
        'voice_ready',
      ],
      mode: useAGI ? 'agi' : 'basic',
      tools_available: useAGI && 'getToolCount' in agent ? (agent as any).getToolCount() : 0,
      timestamp: new Date().toISOString(),
    });
  }

  // WhatsApp verification
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WA_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return respond({ error: 'forbidden' }, { status: 403 });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const rawBody = await req.text();
    
    logStructuredEvent('CALL_CENTER_BODY_RECEIVED', {
      bodyLength: rawBody.length,
      correlationId,
    });

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      logStructuredEvent('CALL_CENTER_ERROR', {
        stage: 'parsing',
        error: parseError instanceof Error ? parseError.message : 'JSON parse failed',
        correlationId,
      }, 'error');
      return respond({ error: 'invalid_json' }, { status: 400 });
    }

    // Handle agent-to-agent consultation (direct call, no WhatsApp wrapper)
    if (isConsultation && payload.message) {
      logStructuredEvent('CALL_CENTER_CONSULTATION', {
        sourceAgent,
        correlationId,
      });

      const response = await agent.process({
        phone: payload.sessionId || 'consultation',
        message: payload.message,
        session: {
          id: payload.sessionId || 'consultation',
          userId: payload.sessionId || 'consultation',
        },
        supabase,
        context: { isConsultation: true, sourceAgent },
      });

      return respond(response);
    }

    // Handle WhatsApp webhook
    const signature = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? Deno.env.get('WA_APP_SECRET');
    const allowUnsigned = Deno.env.get('WA_ALLOW_UNSIGNED_WEBHOOKS') === 'true';

    if (signature && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid && !allowUnsigned) {
        logStructuredEvent('CALL_CENTER_ERROR', {
          stage: 'signature_verification',
          error: 'Invalid webhook signature',
          correlationId,
        }, 'error');
        return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    // Extract message
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    // Log parsing result for debugging
    logStructuredEvent('CALL_CENTER_PAYLOAD_PARSED', {
      hasEntry: !!payload?.entry,
      hasChanges: !!payload?.entry?.[0]?.changes,
      hasMessage: !!message,
      messageType: message?.type || 'none',
      correlationId,
    });
    
    if (!message) {
      return respond({ success: true, message: 'No message to process' });
    }

    const phone = message.from;
    let text = message.text?.body ?? '';
    let isVoiceMessage = false;
    let detectedLanguage = 'en'; // Default to English

    // Handle voice/audio messages
    if (message.type === 'audio' || message.type === 'voice') {
      isVoiceMessage = true;
      
      try {
        const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
        const mediaId = message.audio?.id ?? message.voice?.id;
        
        if (!mediaId || !accessToken) {
          throw new Error('Missing media ID or access token');
        }

        await logStructuredEvent('CALL_CENTER_VOICE_PROCESSING', {
          phone: phone.slice(-4),
          mediaId: mediaId.slice(0, 10),
          correlationId,
        });

        // Download and transcribe audio
        const audioBuffer = await downloadWhatsAppAudio(mediaId, accessToken);
        const { text: transcribedText, language } = await transcribeAudio(audioBuffer, 'ogg');
        
        text = transcribedText;
        detectedLanguage = language || 'en'; // Store detected language for TTS

        await logStructuredEvent('CALL_CENTER_VOICE_TRANSCRIBED', {
          phone: phone.slice(-4),
          language: detectedLanguage,
          textLength: text.length,
          correlationId,
        });

      } catch (voiceError) {
        await logStructuredEvent('CALL_CENTER_VOICE_ERROR', {
          error: voiceError instanceof Error ? voiceError.message : String(voiceError),
          correlationId,
        }, 'error');
        
        // Fall back to text response
        await sendText(phone, 
          "I'm sorry, I had trouble processing your voice message. Please try sending a text message instead."
        );
        return respond({ success: true, message: 'voice_processing_failed' });
      }
    }

    // Deduplication
    const shouldProcess = await deduplicator.shouldProcess({
      messageId: message.id,
      from: phone,
      type: message.type,
      timestamp: message.timestamp,
      body: text,
    });

    if (!shouldProcess) {
      return respond({ success: true, message: 'duplicate_ignored' });
    }

    await logStructuredEvent('CALL_CENTER_MESSAGE', {
      phone: phone.slice(-4),
      messageType: message.type,
      isVoice: isVoiceMessage,
      correlationId,
    });

    // Process with call center agent
    const response = await agent.process({
      phone,
      message: text,
      session: {
        id: phone,
        userId: phone,
      },
      supabase,
    });

    // Send response - voice for voice, text for text
    if (isVoiceMessage) {
      try {
        const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WABA_ACCESS_TOKEN') ?? '';
        const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? Deno.env.get('WABA_PHONE_NUMBER_ID') ?? '';
        
        if (!accessToken || !phoneNumberId) {
          throw new Error('Missing WhatsApp credentials for voice response');
        }

        // Convert response to audio using detected language
        const ttsLang = detectedLanguage.startsWith('rw') ? 'rw' 
          : detectedLanguage.startsWith('fr') ? 'fr'
          : detectedLanguage.startsWith('sw') ? 'sw'
          : 'en';
        const audioBuffer = await textToSpeech(response.message, ttsLang, 'alloy');
        
        // Upload to WhatsApp
        const mediaId = await uploadWhatsAppMedia(audioBuffer, accessToken, phoneNumberId);
        
        // Send audio message
        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'audio',
            audio: { id: mediaId },
          }),
        });

        await logStructuredEvent('CALL_CENTER_VOICE_RESPONSE_SENT', {
          phone: phone.slice(-4),
          correlationId,
        });

      } catch (voiceError) {
        await logStructuredEvent('CALL_CENTER_VOICE_RESPONSE_ERROR', {
          error: voiceError instanceof Error ? voiceError.message : String(voiceError),
          correlationId,
        }, 'error');
        
        // Fall back to text
        await sendText(phone, response.message);
      }
    } else {
      await sendText(phone, response.message);
    }

    await logStructuredEvent('CALL_CENTER_RESPONSE_SENT', {
      phone: phone.slice(-4),
      consultedAgent: response.metadata?.consultedAgent,
    });

    return respond({
      success: true,
      agentType: response.agentType,
      consultedAgent: response.metadata?.consultedAgent,
    });

  } catch (error) {
    await logStructuredEvent('CALL_CENTER_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});
