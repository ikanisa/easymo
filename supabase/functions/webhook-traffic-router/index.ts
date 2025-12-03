/**
 * Webhook Traffic Router
 * 
 * Gradually routes webhook traffic to wa-webhook-unified for safe migration.
 * 
 * Features:
 * - Configurable percentage-based routing
 * - Domain detection (jobs, marketplace, property)
 * - Comprehensive logging for monitoring
 * - Automatic fallback to legacy webhooks
 * - Real-time metrics collection
 * 
 * Week 6 Implementation - Traffic Migration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RoutingConfig {
  percentage: number;
  enabled: boolean;
  domains: string[];
}

async function getRoutingConfig(): Promise<RoutingConfig> {
  const { data, error } = await supabase
    .from('webhook_routing_config')
    .select('percentage, enabled, domains')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    console.error('Failed to get routing config:', error);
    return { percentage: 0, enabled: false, domains: [] };
  }
  
  return data as RoutingConfig;
}

function determineDomain(payload: any): string {
  const messageBody = (payload.message?.text?.body || '').toLowerCase();
  const messageType = payload.type;
  
  if (messageType === 'interactive' && payload.message?.interactive) {
    const buttonId = payload.message.interactive.button_reply?.id || '';
    if (buttonId.includes('job')) return 'jobs';
    if (buttonId.includes('property') || buttonId.includes('rent')) return 'property';
    if (buttonId.includes('shop') || buttonId.includes('buy')) return 'marketplace';
  }
  
  const keywords = {
    jobs: ['job', 'hiring', 'apply', 'career', 'work', 'employment'],
    property: ['property', 'rent', 'apartment', 'house', 'real estate'],
    marketplace: ['buy', 'shop', 'product', 'order', 'cart', 'purchase']
  };
  
  for (const [domain, words] of Object.entries(keywords)) {
    if (words.some(word => messageBody.includes(word))) {
      return domain;
    }
  }
  
  return 'unknown';
}

async function logRouting(data: {
  webhookName: string;
  domain: string;
  routedTo: 'unified' | 'legacy' | 'error';
  fromNumber?: string;
  messageId?: string;
  responseTimeMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}): Promise<void> {
  try {
    await supabase.from('webhook_routing_logs').insert({
      webhook_name: data.webhookName,
      domain: data.domain,
      routed_to: data.routedTo,
      from_number: data.fromNumber,
      message_id: data.messageId,
      response_time_ms: data.responseTimeMs,
      status: data.status,
      error_message: data.errorMessage
    });
  } catch (error) {
    console.error('Failed to log routing:', error);
  }
}

serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  const correlationId = req.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  
  const respond = (body: any, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'X-Service': 'webhook-traffic-router'
      }
    });
  };
  
  try {
    if (req.method === 'GET') {
      const config = await getRoutingConfig();
      return respond({
        status: 'healthy',
        service: 'webhook-traffic-router',
        version: '1.0.0',
        routing: config,
        timestamp: new Date().toISOString()
      });
    }
    
    const payload = await req.json();
    const { from, message } = payload;
    
    const config = await getRoutingConfig();
    const domain = determineDomain(payload);
    
    const shouldRoute = 
      config.enabled && 
      config.domains.includes(domain) &&
      Math.random() * 100 < config.percentage;
    
    let targetWebhook: string;
    let routedTo: 'unified' | 'legacy';
    
    if (shouldRoute) {
      targetWebhook = 'wa-webhook-unified';
      routedTo = 'unified';
    } else {
      targetWebhook = domain === 'unknown' ? 'wa-webhook' : `wa-webhook-${domain}`;
      routedTo = 'legacy';
    }
    
    const baseUrl = Deno.env.get('SUPABASE_URL');
    const targetUrl = `${baseUrl}/functions/v1/${targetWebhook}`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'X-Webhook-Domain': domain,
        'X-Routed-From': 'traffic-router',
        'X-Routing-Percentage': config.percentage.toString(),
      },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    const status = response.ok ? 'success' : 'error';
    
    logRouting({
      webhookName: targetWebhook,
      domain,
      routedTo,
      fromNumber: from,
      messageId: message?.id,
      responseTimeMs: responseTime,
      status,
      errorMessage: response.ok ? undefined : await response.clone().text()
    });
    
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'X-Routed-To': targetWebhook,
        'X-Routing-Decision': routedTo,
        'X-Response-Time-Ms': responseTime.toString()
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Router error:', error);
    
    await logRouting({
      webhookName: 'router-error',
      domain: 'unknown',
      routedTo: 'error',
      responseTimeMs: responseTime,
      status: 'error',
      errorMessage: error.message
    });
    
    return respond(
      { error: 'Routing failed', message: error.message, correlationId },
      500
    );
  }
});
