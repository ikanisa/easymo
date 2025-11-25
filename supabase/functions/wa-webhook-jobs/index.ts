import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "shared/observability.ts";
import { sendText } from "shared/wa-webhook-shared/wa/client.ts";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "shared/wa-webhook-shared/types.ts";
import { getFirstMessage, getTextBody } from "shared/wa-webhook-shared/utils/messages.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const logEvent = (event: string, details: Record<string, unknown> = {}, level: "info" | "error" = "info") => {
    logStructuredEvent(event, { service: "wa-webhook-jobs", requestId, ...details }, level);
  };

  if (req.method === "POST") {
    try {
      const payload: WhatsAppWebhookPayload = await req.json();
      const message = getFirstMessage(payload);
      
      if (!message?.from) {
        return new Response(JSON.stringify({ success: true, ignored: "no_message" }), { headers: { "Content-Type": "application/json" } });
      }

      const input = extractInput(message);
      const text = input ?? "";

      logEvent("JOBS_MESSAGE_RECEIVED", { from: message.from, input: text });

      if (!text) {
        await sendText(message.from, "👷 Welcome to EasyMO Jobs! Type 'jobs' to open the job board menu.");
      } else if (text === "jobs_agent" || text === "jobs" || text === "menu") {
        await sendText(message.from, "👷 *EasyMO Jobs*\n\n1. 🔍 Search Jobs\n2. 📝 Post a Job\n\nReply with a number or type 'menu' to exit.");
      } else if (text === "1" || text.includes("search")) {
        await sendText(message.from, "🔍 *Search Jobs*\n\nPlease enter a job title or keyword (e.g., 'Driver', 'Cook').");
      } else if (text === "2" || text.includes("post")) {
        await sendText(message.from, "📝 *Post a Job*\n\nSend job details here and our team will assist you.");
      } else {
        await sendText(message.from, `You said: "${text}"\n\nType 'jobs' to open the menu.`);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      logEvent("JOBS_ERROR", { error: String(error) }, "error");
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }
  }

  return new Response("OK");
});

function extractInput(message: WhatsAppMessage): string | null {
  if (message.type === "interactive") {
    const interactive = (message as any).interactive;
    const id = interactive?.button_reply?.id ?? interactive?.list_reply?.id;
    if (id?.trim()) return id.trim().toLowerCase();
    const title = interactive?.button_reply?.title ?? interactive?.list_reply?.title;
    if (title?.trim()) return title.trim().toLowerCase();
    return null;
  }
  if (message.type === "text") {
    const body = (message.text as any)?.body;
    return typeof body === "string" ? body.trim().toLowerCase() : null;
  }
  return null;
}
