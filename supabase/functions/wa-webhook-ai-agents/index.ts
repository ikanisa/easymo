/**
 * @deprecated FULLY DEPRECATED - DO NOT DEPLOY
 * 
 * WA-Webhook-AI-Agents - Unified AI Agent System (LEGACY)
 * 
 * This service has been consolidated into wa-webhook-unified.
 * All agents (waiter, farmer, support, sales, marketplace, business_broker)
 * are now available in wa-webhook-unified with:
 * - Dual AI provider support (Gemini 2.5 Pro + GPT-5)
 * - Provider fallback mechanism
 * - Consolidated BuySellAgent (merges marketplace + business_broker)
 * - Exit keywords for returning to main menu
 * 
 * Migration completed: 2025-12
 * 
 * This file is kept for reference only and should be moved to .archive/
 * 
 * @see supabase/functions/wa-webhook-unified for the consolidated service
 * @see docs/WA_WEBHOOK_CONSOLIDATION.md for migration guide
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { UnifiedOrchestrator } from './core/unified-orchestrator.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { logStructuredEvent } from '../_shared/observability.ts';
import { sendWhatsAppMessage } from '../_shared/wa-webhook-shared/wa/client.ts';
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
import { MessageDeduplicator } from '../_shared/message-deduplicator.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const orchestrator = new UnifiedOrchestrator(supabase);
const deduplicator = new MessageDeduplicator(supabase);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

  // Rate limiting (100 req/min for high-volume WhatsApp AI processing)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    await logStructuredEvent('WA_AI_AGENTS_RATE_LIMITED', {
      correlationId,
      remaining: rateLimitCheck.result.remaining,
    });
    return rateLimitCheck.response!;
  }

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-ID', requestId);
    headers.set('X-Correlation-ID', correlationId);
    headers.set('X-Service', 'wa-webhook-ai-agents-unified');
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check endpoint
  if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
    const agents = orchestrator.getRegistry().listAgents();
    
    return respond({
      status: 'healthy',
      service: 'wa-webhook-ai-agents',
      version: '4.0.0-unified',
      timestamp: new Date().toISOString(),
      architecture: 'unified',
      features: {
        unifiedOrchestrator: true,
        intentClassification: true,
        sessionManagement: true,
        multipleAgents: true,
      },
      agents: agents.map(a => ({
        type: a.type,
        name: a.name,
        description: a.description,
      })),
      provider: 'gemini-2.0-flash-exp',
    });
  }

  // WhatsApp verification handshake (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WA_VERIFY_TOKEN');

    if (!verifyToken) {
      await logStructuredEvent('WA_VERIFY_TOKEN_NOT_SET', { correlationId }, 'error');
      return respond({ error: 'server_misconfigured' }, { status: 500 });
    }

    if (mode === 'subscribe' && token && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return respond({ error: 'forbidden' }, { status: 403 });
  }

  // Only POST is allowed for webhook messages
  if (req.method !== 'POST') {
    return respond({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature
    const signature = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? Deno.env.get('WA_APP_SECRET');
    const allowUnsigned = (Deno.env.get('WA_ALLOW_UNSIGNED_WEBHOOKS') ?? 'false').toLowerCase() === 'true';

    if (!appSecret) {
      await logStructuredEvent('WA_APP_SECRET_NOT_SET', { correlationId }, 'error');
      return respond({ error: 'server_misconfigured' }, { status: 500 });
    }

    let isValid = false;
    if (signature) {
      isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
    }

    if (!isValid && !allowUnsigned) {
      await logStructuredEvent('WA_SIGNATURE_INVALID', { correlationId }, 'warn');
      return respond({ error: 'unauthorized' }, { status: 401 });
    }

    // Parse payload
    const payload = JSON.parse(rawBody);

    // Extract message from WhatsApp webhook payload
    const message = extractMessage(payload);
    if (!message) {
      return respond({ success: true, message: 'No message to process' }, { status: 200 });
    }

    const phone = message.from;
    const text = message.text?.body ?? '';
    
    // Check for duplicate messages using MessageDeduplicator
    const shouldProcess = await deduplicator.shouldProcess({
      messageId: message.id,
      from: phone,
      type: message.type,
      timestamp: message.timestamp,
      body: text,
    });

    if (!shouldProcess) {
      await logStructuredEvent('WA_AI_AGENT_DUPLICATE_MESSAGE', {
        correlationId,
        messageId: message.id,
        phone: phone.slice(-4),
      }, 'info');
      return respond({ success: true, message: 'duplicate_ignored' }, { status: 200 });
    }
    
    // Get agent type from menu selection
    const agentType = extractAgentType(message);

    await logStructuredEvent('WA_AI_AGENT_MESSAGE_RECEIVED', {
      phone: phone.slice(-4),
      hasText: !!text,
      agentType: agentType ?? 'auto',
      messageType: message.type,
    });

    // Process with unified orchestrator
    const response = await orchestrator.processMessage({
      phone,
      message: text,
      agentType,
    });

    await logStructuredEvent('WA_AI_AGENT_RESPONSE_GENERATED', {
      agentType: response.agentType,
      responseLength: response.message.length,
    });

    // Send WhatsApp response
    await sendWhatsAppMessage(phone, response.message);

    await logStructuredEvent('WA_AI_AGENT_MESSAGE_SENT', {
      phone: phone.slice(-4),
      agentType: response.agentType,
    });

    return respond({ success: true, agentType: response.agentType }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logStructuredEvent('WA_AI_AGENT_ERROR', { 
      error: errorMessage,
      correlationId,
    }, 'error');
    
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});

function extractMessage(payload: any): any | null {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0];
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

function extractAgentType(message: any): string | undefined {
  try {
    const interactive = message.interactive;
    if (!interactive) return undefined;
    if (interactive.list_reply?.id) {
      return interactive.list_reply.id;
    }
    if (interactive.button_reply?.id) {
      return interactive.button_reply.id;
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined;
}
