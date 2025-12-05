/**
 * WA-Agent-Waiter - Bar & Restaurant AI Agent
 * 
 * Standalone edge function for food service.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WaiterAgent } from './core/waiter-agent.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { logStructuredEvent } from '../_shared/observability.ts';
import { sendWhatsAppMessage } from '../_shared/wa-webhook-shared/wa/client.ts';
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
import { MessageDeduplicator } from '../_shared/message-deduplicator.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const agent = new WaiterAgent();
const deduplicator = new MessageDeduplicator(supabase);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

  const rateLimitCheck = await rateLimitMiddleware(req, { limit: 60, windowSeconds: 60 });
  if (!rateLimitCheck.allowed) return rateLimitCheck.response!;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-ID', requestId);
    headers.set('X-Service', 'wa-agent-waiter');
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  if (url.pathname.endsWith('/health')) {
    return respond({ status: 'healthy', service: 'wa-agent-waiter', agent: agent.type });
  }

  if (req.method === 'GET') {
    const token = url.searchParams.get('hub.verify_token');
    if (token === Deno.env.get('WA_VERIFY_TOKEN')) {
      return new Response(url.searchParams.get('hub.challenge') ?? '');
    }
    return respond({ error: 'forbidden' }, { status: 403 });
  }

  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, { status: 405 });

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    
    if (signature && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid && Deno.env.get('WA_ALLOW_UNSIGNED_WEBHOOKS') !== 'true') {
        return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return respond({ success: true, message: 'No message' });

    const phone = message.from;
    const text = message.text?.body ?? '';

    if (!await deduplicator.shouldProcess({
      messageId: message.id, from: phone, type: message.type,
      timestamp: message.timestamp, body: text,
    })) {
      return respond({ success: true, message: 'duplicate_ignored' });
    }

    const response = await agent.process({
      phone, message: text,
      session: { id: phone, userId: phone },
      supabase,
    });

    await sendWhatsAppMessage(phone, response.message);
    return respond({ success: true, agentType: response.agentType });

  } catch (error) {
    await logStructuredEvent('WAITER_AGENT_ERROR', { error: String(error), correlationId }, 'error');
    return respond({ error: 'internal_error' }, { status: 500 });
  }
});
