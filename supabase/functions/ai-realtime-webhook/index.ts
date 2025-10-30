import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * AI Realtime API Webhook
 * Receives tool call events from OpenAI Realtime API during voice conversations
 */

interface ToolCallEvent {
  type: string;
  event_id: string;
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Execute tool call
 */
async function executeToolCall(
  toolName: string,
  args: any,
  correlationId: string
): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const functionMapping: Record<string, string> = {
    lookup_customer: "ai-lookup-customer",
    create_voucher: "ai-create-voucher",
    redeem_voucher: "ai-redeem-voucher",
    void_voucher: "ai-void-voucher",
  };

  const functionName = functionMapping[toolName];
  if (!functionName) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  console.log(
    JSON.stringify({
      event: "ai.realtime.tool.call",
      correlation_id: correlationId,
      tool_name: toolName,
      function_name: functionName,
      timestamp: new Date().toISOString(),
    })
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      "x-correlation-id": correlationId,
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Function call failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Check feature flag
    const featureEnabled = Deno.env.get("FEATURE_AGENT_VOICE") === "true" ||
                          Deno.env.get("FEATURE_AGENT_VOICE") === "1";

    if (!featureEnabled) {
      console.log(
        JSON.stringify({
          event: "ai.realtime.webhook.disabled",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        })
      );
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event: ToolCallEvent = await req.json();

    console.log(
      JSON.stringify({
        event: "ai.realtime.webhook.received",
        correlation_id: correlationId,
        event_type: event.type,
        event_id: event.event_id,
        call_id: event.call_id,
        tool_name: event.name,
        timestamp: new Date().toISOString(),
      })
    );

    // Handle function call event
    if (event.type === "response.function_call_arguments.done" || event.type === "call_tool") {
      try {
        const args = JSON.parse(event.arguments || "{}");
        const result = await executeToolCall(event.name, args, correlationId);

        console.log(
          JSON.stringify({
            event: "ai.realtime.tool.success",
            correlation_id: correlationId,
            call_id: event.call_id,
            timestamp: new Date().toISOString(),
          })
        );

        return new Response(
          JSON.stringify({
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify(result),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "ai.realtime.tool.error",
            correlation_id: correlationId,
            call_id: event.call_id,
            error: String(error),
          })
        );

        return new Response(
          JSON.stringify({
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({
              success: false,
              error: String(error),
            }),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // Unknown event type
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai.realtime.webhook.exception",
        correlation_id: correlationId,
        error: String(error),
      })
    );

    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
