import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "shared/observability.ts";
import { sendText } from "shared/wa-webhook-shared/wa/client.ts";
import type { WhatsAppWebhookPayload } from "shared/wa-webhook-shared/types.ts";
import { getFirstMessage, getTextBody } from "shared/wa-webhook-shared/utils/messages.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const logEvent = (event: string, details: Record<string, unknown> = {}, level: "info" | "error" = "info") => {
    logStructuredEvent(event, { service: "wa-webhook-property", requestId, ...details }, level);
  };

  if (req.method === "POST") {
    try {
      const payload: WhatsAppWebhookPayload = await req.json();
      const message = getFirstMessage(payload);
      
      if (message) {
        const from = message.from;
        const text = getTextBody(message as any) || "";
        
        logEvent("PROPERTY_MESSAGE_RECEIVED", { from, text });

        if (text.toLowerCase().includes("property") || text.toLowerCase().includes("estate")) {
           await sendText(from, "🏠 *EasyMO Property*\n\n1. 🔍 Search Rentals\n2. 💰 Buy Property\n\nReply with a number or type 'Menu' to exit.");
        } else if (text === "1") {
           await sendText(from, "🔍 *Search Rentals*\n\nWhat location are you interested in?");
        } else if (text === "2") {
           await sendText(from, "💰 *Buy Property*\n\nPlease contact our agents at +250 788 123 456.");
        } else {
           await sendText(from, `You said: "${text}"\n\nType '1' for Rentals, '2' to Buy, or 'Menu' to exit.`);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      logEvent("PROPERTY_ERROR", { error: String(error) }, "error");
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }
  }

  return new Response("OK");
});
