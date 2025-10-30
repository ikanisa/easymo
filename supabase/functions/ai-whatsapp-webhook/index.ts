import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI Agent WhatsApp Webhook
 * Receives WhatsApp messages and routes them through OpenAI Responses API
 * Feature-flagged integration for AI-powered voucher assistance
 */

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

// In-memory cache for idempotency (in production, use Redis/database)
const processedMessageIds = new Set<string>();
const MESSAGE_CACHE_TTL = 3600000; // 1 hour

/**
 * Send WhatsApp message via Graph API
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  correlationId: string
): Promise<void> {
  const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL") || "https://graph.facebook.com/v20.0";
  const phoneNumberId = Deno.env.get("WA_PHONE_ID");
  const accessToken = Deno.env.get("WA_TOKEN");

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp configuration missing");
  }

  const url = `${whatsappApiUrl}/${phoneNumberId}/messages`;

  console.log(
    JSON.stringify({
      event: "ai.whatsapp.send.start",
      correlation_id: correlationId,
      to_masked: to.substring(0, 5) + "***" + to.slice(-3),
      timestamp: new Date().toISOString(),
    })
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      JSON.stringify({
        event: "ai.whatsapp.send.error",
        correlation_id: correlationId,
        status: response.status,
        error: errorText,
      })
    );
    throw new Error(`WhatsApp send failed: ${response.status}`);
  }

  console.log(
    JSON.stringify({
      event: "ai.whatsapp.send.success",
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Process message through OpenAI Responses API
 */
async function processWithAI(
  userMessage: string,
  from: string,
  correlationId: string
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // For now, call a simple responses API endpoint
  // In production, this would use the full conversation history
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const responsesModel = Deno.env.get("OPENAI_RESPONSES_MODEL") || "gpt-4o-mini";

  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  console.log(
    JSON.stringify({
      event: "ai.process.start",
      correlation_id: correlationId,
      model: responsesModel,
      timestamp: new Date().toISOString(),
    })
  );

  // Build conversation with system prompt
  const messages = [
    {
      role: "system",
      content: `You are the EasyMO Voucher Agent assistant on WhatsApp.

Your role:
- Help customers with voucher operations (create, redeem, void, lookup)
- Use tools for any database operations
- Currency defaults to RWF (Rwandan Franc) unless specified
- Always be polite and confirm actions with the customer
- Keep responses concise for WhatsApp (max 2-3 sentences)

Guidelines:
- Before creating a voucher, verify the customer exists
- Confirm voucher amounts with the customer before creation
- Explain voucher status clearly (issued, redeemed, void)
- When voiding vouchers, ask for a reason if not provided

Security:
- Never expose internal IDs or system details
- Always validate customer MSISDN format before operations`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  // Define available tools
  const tools = [
    {
      type: "function",
      function: {
        name: "lookup_customer",
        description: "Find customer by mobile number to check if they exist",
        parameters: {
          type: "object",
          properties: {
            msisdn: {
              type: "string",
              description: "Customer mobile number (E.164 format, e.g., +250788000000)",
            },
          },
          required: ["msisdn"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_voucher",
        description: "Create a new voucher for a customer",
        parameters: {
          type: "object",
          properties: {
            customer_msisdn: {
              type: "string",
              description: "Customer mobile number",
            },
            amount: {
              type: "number",
              description: "Voucher amount in RWF",
            },
            currency: {
              type: "string",
              description: "Currency code (default: RWF)",
              default: "RWF",
            },
          },
          required: ["customer_msisdn", "amount"],
        },
      },
    },
  ];

  // Call OpenAI Responses API (simplified - full implementation would handle tool calls)
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: responsesModel,
      messages,
      tools,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      JSON.stringify({
        event: "ai.process.error",
        correlation_id: correlationId,
        error: errorText,
      })
    );
    throw new Error("OpenAI API call failed");
  }

  const data = await response.json();
  const assistantMessage = data.choices[0]?.message?.content || "I'm here to help with vouchers. What would you like to do?";

  console.log(
    JSON.stringify({
      event: "ai.process.success",
      correlation_id: correlationId,
      has_tool_calls: !!data.choices[0]?.message?.tool_calls,
      timestamp: new Date().toISOString(),
    })
  );

  return assistantMessage;
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  try {
    // Handle webhook verification (GET)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const verifyToken = Deno.env.get("WA_VERIFY_TOKEN");

      if (mode === "subscribe" && token === verifyToken) {
        console.log(
          JSON.stringify({
            event: "ai.whatsapp.webhook.verify",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          })
        );
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // Handle webhook payload (POST)
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Check feature flag
    const featureEnabled = Deno.env.get("FEATURE_AGENT_CHAT") === "true" ||
                          Deno.env.get("FEATURE_AGENT_CHAT") === "1";

    if (!featureEnabled) {
      console.log(
        JSON.stringify({
          event: "ai.whatsapp.webhook.disabled",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        })
      );
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: WhatsAppWebhookPayload = await req.json();

    console.log(
      JSON.stringify({
        event: "ai.whatsapp.webhook.received",
        correlation_id: correlationId,
        entry_count: payload.entry?.length || 0,
        timestamp: new Date().toISOString(),
      })
    );

    // Process messages
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];

        for (const message of messages) {
          // Idempotency check
          if (processedMessageIds.has(message.id)) {
            console.log(
              JSON.stringify({
                event: "ai.whatsapp.message.duplicate",
                correlation_id: correlationId,
                message_id: message.id,
              })
            );
            continue;
          }

          // Only process text messages
          if (message.type !== "text" || !message.text?.body) {
            continue;
          }

          // Mark as processed
          processedMessageIds.add(message.id);
          setTimeout(() => processedMessageIds.delete(message.id), MESSAGE_CACHE_TTL);

          const userMessage = message.text.body;
          const from = message.from;

          console.log(
            JSON.stringify({
              event: "ai.whatsapp.message.processing",
              correlation_id: correlationId,
              message_id: message.id,
              from_masked: from.substring(0, 5) + "***" + from.slice(-3),
              timestamp: new Date().toISOString(),
            })
          );

          try {
            // Process with AI
            const aiResponse = await processWithAI(userMessage, from, correlationId);

            // Send response
            await sendWhatsAppMessage(from, aiResponse, correlationId);

            console.log(
              JSON.stringify({
                event: "ai.whatsapp.message.success",
                correlation_id: correlationId,
                message_id: message.id,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (error) {
            console.error(
              JSON.stringify({
                event: "ai.whatsapp.message.error",
                correlation_id: correlationId,
                message_id: message.id,
                error: String(error),
              })
            );

            // Send error response to user
            try {
              await sendWhatsAppMessage(
                from,
                "Sorry, I'm having trouble processing your request right now. Please try again later.",
                correlationId
              );
            } catch (sendError) {
              console.error(
                JSON.stringify({
                  event: "ai.whatsapp.error_response.failed",
                  correlation_id: correlationId,
                  error: String(sendError),
                })
              );
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai.whatsapp.webhook.exception",
        correlation_id: correlationId,
        error: String(error),
      })
    );

    // Always return 200 to prevent webhook retries on our errors
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
