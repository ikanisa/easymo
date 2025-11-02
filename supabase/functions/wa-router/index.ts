import { handleRequest } from "../../../apps/router-fn/src/router.ts";

const encoder = new TextEncoder();
const WA_VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN") ?? "";
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET") ?? "";
const DEST_EASYMO_URL = Deno.env.get("DEST_EASYMO_URL") ?? "";
const DEST_INSURANCE_URL = Deno.env.get("DEST_INSURANCE_URL") ?? "";
const DEST_BASKET_URL = Deno.env.get("DEST_BASKET_URL") ?? "";
const DEST_QR_URL = Deno.env.get("DEST_QR_URL") ?? "";
const DEST_DINE_URL = Deno.env.get("DEST_DINE_URL") ?? "";
const ROUTER_ENABLED = Deno.env.get("ROUTER_ENABLED") !== "false"; // Feature flag, defaults to enabled

// Initialize Supabase client for logging and idempotency
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Allowlist of valid destination URLs
const ALLOWED_DESTINATIONS = new Set([
  DEST_EASYMO_URL,
  DEST_INSURANCE_URL,
  DEST_BASKET_URL,
  DEST_QR_URL,
  DEST_DINE_URL,
].filter(Boolean));

interface WhatsAppMessage {
  id: string; from: string; type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string } };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string };
}

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: Array<{ value?: { messaging_product?: string; metadata?: { display_phone_number?: string; phone_number_id?: string }; contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>; messages?: WhatsAppMessage[] }; field?: string }> }>;
}

interface NormalizedPayload {
  from: string; messageId: string; type: string; text?: string; keyword?: string;
  interactive?: { type: string; id: string; title?: string };
  media?: { type: string; id: string; caption?: string };
  metadata?: { phoneNumberId?: string; displayPhoneNumber?: string };
}

interface RouteResult {
  keyword: string; destinationUrl: string; status: number; responseTime: number; error?: string;
}

// Verify HMAC SHA-256 signature
export async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=")) return false;
  const theirHex = header.slice(7);
  const key = await crypto.subtle.importKey("raw", encoder.encode(WA_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ourBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const ourBytes = new Uint8Array(ourBuf);
  const theirBytes = hexToBytes(theirHex);
  if (ourBytes.length !== theirBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < ourBytes.length; i++) diff |= ourBytes[i] ^ theirBytes[i];
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Extract and normalize WhatsApp messages from webhook payload
export function normalizePayload(payload: WhatsAppWebhookPayload): NormalizedPayload[] {
  const normalized: NormalizedPayload[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const metadata = value.metadata;
      const messages = value.messages ?? [];
      for (const msg of messages) {
        const norm: NormalizedPayload = {
          from: msg.from, messageId: msg.id, type: msg.type,
          metadata: { phoneNumberId: metadata?.phone_number_id, displayPhoneNumber: metadata?.display_phone_number },
        };
        // Extract text and keyword
        if (msg.type === "text" && msg.text?.body) {
          norm.text = msg.text.body;
          norm.keyword = extractKeyword(msg.text.body);
        }
        // Extract interactive button/list data
        if (msg.type === "interactive" && msg.interactive) {
          if (msg.interactive.button_reply) {
            norm.interactive = { type: "button_reply", id: msg.interactive.button_reply.id, title: msg.interactive.button_reply.title };
            norm.keyword = extractKeyword(msg.interactive.button_reply.id);
          } else if (msg.interactive.list_reply) {
            norm.interactive = { type: "list_reply", id: msg.interactive.list_reply.id };
            norm.keyword = extractKeyword(msg.interactive.list_reply.id);
          }
        }
        // Extract media data
        if (msg.type === "image" && msg.image) {
          norm.media = { type: "image", id: msg.image.id, caption: msg.image.caption };
          if (msg.image.caption) norm.keyword = extractKeyword(msg.image.caption);
        }
        if (msg.type === "document" && msg.document) {
          norm.media = { type: "document", id: msg.document.id, caption: msg.document.caption };
          if (msg.document.caption) norm.keyword = extractKeyword(msg.document.caption);
        }
        normalized.push(norm);
      }
    }
  }
  return normalized;
}

// Extract keyword from text for routing
export function extractKeyword(text: string): string | undefined {
  const cleaned = text.toLowerCase().trim();
  const keywords = ["easymo", "insurance", "basket", "baskets", "qr", "dine"];
  for (const keyword of keywords) {
    if (cleaned.includes(keyword)) return keyword === "baskets" ? "basket" : keyword;
  }
  return undefined;
}

// Route message to destination URL based on keyword
export function getDestinationUrl(keyword?: string): string | undefined {
  if (!keyword) return undefined;
  const routes: Record<string, string> = {
    easymo: DEST_EASYMO_URL, insurance: DEST_INSURANCE_URL, basket: DEST_BASKET_URL,
    qr: DEST_QR_URL, dine: DEST_DINE_URL,
  };
  const url = routes[keyword];
  // Enforce allowlist: only return URL if it's in the allowed set
  if (url && ALLOWED_DESTINATIONS.has(url)) {
    return url;
  }
  return undefined;
}

// Forward payload to destination URL
export async function forwardToDestination(destinationUrl: string, payload: NormalizedPayload, originalPayload: WhatsAppWebhookPayload): Promise<RouteResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(destinationUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ normalized: payload, original: originalPayload }),
    });
    return { keyword: payload.keyword ?? "unknown", destinationUrl, status: response.status, responseTime: Date.now() - startTime };
  } catch (error) {
    return { keyword: payload.keyword ?? "unknown", destinationUrl, status: 0, responseTime: Date.now() - startTime, error: String(error) };
  }
}

// Structured logging
function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}

// Persist router log to database
async function persistRouterLog(
  messageId: string,
  textSnippet: string | undefined,
  routeKey: string | undefined,
  statusCode: string,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!supabase) return; // Skip if Supabase not configured
  
  try {
    // Truncate text snippet to 500 chars for privacy/storage
    const snippet = textSnippet ? textSnippet.substring(0, 500) : null;
    
    await supabase.from("router_logs").insert({
      message_id: messageId,
      text_snippet: snippet,
      route_key: routeKey,
      status_code: statusCode,
      metadata: metadata,
    });
  } catch (error) {
    // Log error but don't fail the request
    logEvent("ROUTER_LOG_PERSIST_FAILED", { messageId, error: String(error) });
  }
}

// Check if message has already been processed (idempotency)
async function isMessageProcessed(messageId: string): Promise<boolean> {
  if (!supabase) return false; // Skip if Supabase not configured
  
  try {
    const { data, error } = await supabase
      .from("router_logs")
      .select("message_id")
      .eq("message_id", messageId)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      logEvent("IDEMPOTENCY_CHECK_FAILED", { messageId, error: String(error) });
      return false; // On error, allow processing to continue
    }
    
    return data !== null;
  } catch (error) {
    logEvent("IDEMPOTENCY_CHECK_ERROR", { messageId, error: String(error) });
    return false; // On error, allow processing to continue
  }
}

// Main handler
Deno.serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();
  try {
    // Check feature flag
    if (!ROUTER_ENABLED) {
      logEvent("ROUTER_DISABLED", { correlationId });
      return new Response("Service Unavailable", { status: 503 });
    }
    
    // Handle GET requests for webhook verification
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      logEvent("WEBHOOK_VERIFICATION_REQUEST", { correlationId, mode, token: token ? "present" : "missing" });
      if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
        logEvent("WEBHOOK_VERIFICATION_SUCCESS", { correlationId });
        return new Response(challenge ?? "", { status: 200 });
      }
      logEvent("WEBHOOK_VERIFICATION_FAILED", { correlationId, reason: "invalid_token" });
      return new Response("Forbidden", { status: 403 });
    }
    // Only accept POST requests
    if (req.method !== "POST") {
      logEvent("INVALID_METHOD", { correlationId, method: req.method });
      return new Response("Method Not Allowed", { status: 405 });
    }
    // Read request body
    const rawBody = await req.text();
    logEvent("REQUEST_RECEIVED", { correlationId, bodySize: rawBody.length });
    // Verify signature
    if (!await verifySignature(req, rawBody)) {
      logEvent("SIGNATURE_VERIFICATION_FAILED", { correlationId });
      return new Response("Unauthorized", { status: 401 });
    }
    logEvent("SIGNATURE_VERIFIED", { correlationId });
    // Parse payload
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logEvent("JSON_PARSE_ERROR", { correlationId, error: String(error) });
      return new Response("Bad Request", { status: 400 });
    }
    // Normalize messages
    const normalized = normalizePayload(payload);
    logEvent("PAYLOAD_NORMALIZED", { correlationId, messageCount: normalized.length });
    if (normalized.length === 0) {
      logEvent("NO_MESSAGES_FOUND", { correlationId });
      return new Response("ok", { status: 200 });
    }
    // Route each message
    const routeResults: RouteResult[] = [];
    for (const msg of normalized) {
      // Check idempotency
      const alreadyProcessed = await isMessageProcessed(msg.messageId);
      if (alreadyProcessed) {
        logEvent("MESSAGE_ALREADY_PROCESSED", { 
          correlationId, 
          messageId: msg.messageId, 
          from: msg.from 
        });
        await persistRouterLog(
          msg.messageId,
          msg.text,
          msg.keyword,
          "duplicate",
          { correlationId, reason: "already_processed" }
        );
        continue;
      }
      
      const keyword = msg.keyword;
      const destinationUrl = getDestinationUrl(keyword);
      if (!destinationUrl) {
        logEvent("NO_ROUTE_FOUND", { correlationId, messageId: msg.messageId, keyword: keyword ?? "none", from: msg.from });
        await persistRouterLog(
          msg.messageId,
          msg.text,
          keyword,
          "unmatched",
          { correlationId, keyword: keyword ?? "none" }
        );
        continue;
      }
      logEvent("ROUTING_MESSAGE", { correlationId, messageId: msg.messageId, keyword, destinationUrl });
      const result = await forwardToDestination(destinationUrl, msg, payload);
      routeResults.push(result);
      logEvent("ROUTE_COMPLETED", {
        correlationId, messageId: msg.messageId, keyword: result.keyword,
        destinationUrl: result.destinationUrl, status: result.status,
        responseTime: result.responseTime, error: result.error,
      });
      
      // Persist router log
      await persistRouterLog(
        msg.messageId,
        msg.text,
        keyword,
        result.error ? "error" : "routed",
        {
          correlationId,
          targetStatus: result.status,
          responseTime: result.responseTime,
          error: result.error,
        }
      );
    }
    logEvent("REQUEST_COMPLETED", { correlationId, totalMessages: normalized.length, routedMessages: routeResults.length });
    // Always return 200 to Meta to acknowledge receipt
    return new Response("ok", { status: 200 });
  } catch (error) {
    logEvent("UNHANDLED_ERROR", { correlationId, error: String(error), stack: error instanceof Error ? error.stack : undefined });
    // Return 200 even on error to prevent Meta from retrying
    return new Response("ok", { status: 200 });
  }
});
