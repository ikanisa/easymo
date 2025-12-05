/**
 * WA-Agent-Farmer - Farmers Market AI Agent
 * 
 * Standalone edge function for agricultural AI support.
 * Uses shared core utilities from wa-webhook-ai-agents.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FarmerAgent } from './core/farmer-agent.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { logStructuredEvent } from '../_shared/observability.ts';
import { sendWhatsAppMessage } from '../_shared/wa-webhook-shared/wa/client.ts';
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
import { MessageDeduplicator } from '../_shared/message-deduplicator.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const agent = new FarmerAgent();
const deduplicator = new MessageDeduplicator(supabase);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

  // Rate limiting
  const rateLimitCheck = await rateLimitMiddleware(req, { limit: 60, windowSeconds: 60 });
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-ID', requestId);
    headers.set('X-Correlation-ID', correlationId);
    headers.set('X-Service', 'wa-agent-farmer');
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
    return respond({
      status: 'healthy',
      service: 'wa-agent-farmer',
      agent: { type: agent.type, name: agent.name },
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
    
    // Verify signature
    const signature = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? Deno.env.get('WA_APP_SECRET');
    const allowUnsigned = Deno.env.get('WA_ALLOW_UNSIGNED_WEBHOOKS') === 'true';

    if (signature && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid && !allowUnsigned) {
        return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const message = extractMessage(payload);
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

    await logStructuredEvent('FARMER_AGENT_MESSAGE', {
      phone: phone.slice(-4),
      correlationId,
    });

    // Process with farmer agent
    const response = await agent.process({
      phone,
      message: text,
      session: { id: phone, userId: phone },
      supabase,
    });

    // Send response
    await sendWhatsAppMessage(phone, response.message);

    return respond({ success: true, agentType: response.agentType });

  } catch (error) {
    await logStructuredEvent('FARMER_AGENT_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});

function extractMessage(payload: any): any | null {
  try {
    return payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  } catch {
    return null;
  }
}
