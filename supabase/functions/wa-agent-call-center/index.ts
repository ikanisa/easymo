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
import { sendWhatsAppMessage } from '../_shared/wa-webhook-shared/wa/client.ts';
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
import { MessageDeduplicator } from '../_shared/message-deduplicator.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Use full AGI implementation (with tools) if enabled, otherwise use basic agent
const useAGI = Deno.env.get('CALL_CENTER_USE_AGI') !== 'false'; // Default to true
const agent = useAGI ? new CallCenterAGI() : new CallCenterAgent();
const deduplicator = new MessageDeduplicator(supabase);

console.log(`Call Center initialized: ${useAGI ? 'AGI (Full Tools)' : 'Basic Agent'}`);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();
  
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
    const payload = JSON.parse(rawBody);

    // Handle agent-to-agent consultation (direct call, no WhatsApp wrapper)
    if (isConsultation && payload.message) {
      await logStructuredEvent('CALL_CENTER_CONSULTATION', {
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
        return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    // Extract message
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      return respond({ success: true, message: 'No message to process' });
    }

    const phone = message.from;
    const text = message.text?.body ?? '';

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

    // Send response
    await sendWhatsAppMessage(phone, response.message);

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
