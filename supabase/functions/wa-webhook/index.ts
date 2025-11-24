import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getWabaCredentials, getSupabaseServiceConfig } from "../_shared/env.ts";
import type { WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import { routeMessage } from "../wa-webhook-core/routing_logic.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_KEY } = getSupabaseServiceConfig();
const MICROSVC_BASE = `${SUPABASE_URL}/functions/v1`;

function withAuth(headers: Headers): Headers {
  const h = new Headers(headers);
  if (!h.get("Authorization")) h.set("Authorization", `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`);
  h.set("Content-Type", "application/json");
  return h;
}

async function tryForward(url: string, req: Request, timeoutMs = 2000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = withAuth(req.headers);
    const res = await fetch(url, { method: req.method, headers, body: req.body, signal: ctrl.signal });
    if (res.status >= 500) return null;
    return res;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fallbackRoute(req: Request): Promise<Response> {
  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const text = msg ? getRoutingText(msg) : null;
    const state = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.routing_state ?? undefined;
    const service = text ? await routeMessage(text, state) : "wa-webhook-core";
    const headers = withAuth(req.headers);
    const url = `${MICROSVC_BASE}/${service}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "WA_WEBHOOK_FALLBACK_ERROR", message }));
    return new Response(JSON.stringify({ success: true, fallback: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Always attempt to forward to core first
  // Health and verification requests are handled by core as well
  const coreUrl = `${MICROSVC_BASE}/wa-webhook-core${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  const forwarded = await tryForward(coreUrl, req);
  if (forwarded) return forwarded;

  // If core failed (timeout/5xx), attempt direct microservice routing
  if (req.method === "POST") {
    const routed = await fallbackRoute(req);
    if (routed.status < 500) return routed;
  }

  // Last resort: ack to avoid 500s
  return new Response(JSON.stringify({ success: true, degraded: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});

