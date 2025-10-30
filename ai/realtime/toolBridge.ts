/**
 * Tool Bridge for Realtime API
 * Handles tool call execution during voice conversations
 */

/**
 * Tool call event from Realtime API
 */
export interface ToolCallEvent {
  type: "response.function_call_arguments.done";
  event_id: string;
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Tool output event to send back to Realtime API
 */
export interface ToolOutputEvent {
  type: "conversation.item.create";
  item: {
    type: "function_call_output";
    call_id: string;
    output: string;
  };
}

/**
 * Execute a tool call from Realtime API
 */
export async function executeToolCall(
  toolCall: ToolCallEvent,
  correlationId: string
): Promise<ToolOutputEvent> {
  console.log(
    JSON.stringify({
      event: "ai.realtime.tool.execute",
      correlation_id: correlationId,
      call_id: toolCall.call_id,
      tool_name: toolCall.name,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const args = JSON.parse(toolCall.arguments);

    // Call the appropriate Supabase function
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const functionName = getFunctionNameForTool(toolCall.name);
    const url = `${supabaseUrl}/functions/v1/${functionName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function call failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    console.log(
      JSON.stringify({
        event: "ai.realtime.tool.success",
        correlation_id: correlationId,
        call_id: toolCall.call_id,
        timestamp: new Date().toISOString(),
      })
    );

    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      },
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai.realtime.tool.error",
        correlation_id: correlationId,
        call_id: toolCall.call_id,
        error: String(error),
      })
    );

    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify({
          success: false,
          error: String(error),
        }),
      },
    };
  }
}

/**
 * Map tool name to Supabase function name
 */
function getFunctionNameForTool(toolName: string): string {
  const mapping: Record<string, string> = {
    lookup_customer: "ai-lookup-customer",
    create_voucher: "ai-create-voucher",
    redeem_voucher: "ai-redeem-voucher",
    void_voucher: "ai-void-voucher",
  };

  const functionName = mapping[toolName];
  if (!functionName) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return functionName;
}

/**
 * Format tool result for natural speech
 * The Realtime API will speak the function output, so format it conversationally
 */
export function formatToolResultForSpeech(
  toolName: string,
  result: any
): string {
  if (!result.success) {
    return `I encountered an error: ${result.error}. Let me try to help you another way.`;
  }

  switch (toolName) {
    case "lookup_customer":
      if (result.exists) {
        return `I found the customer${result.name ? `, ${result.name}` : ""}. What would you like to do?`;
      } else {
        return "I couldn't find that customer in our system. Would you like to create a new account?";
      }

    case "create_voucher":
      return `I've created a voucher for ${result.amount} ${result.currency}. The voucher code is being sent to the customer's phone.`;

    case "redeem_voucher":
      return `The voucher has been successfully redeemed. Thank you!`;

    case "void_voucher":
      return `The voucher has been voided. Is there anything else I can help you with?`;

    default:
      return "Done.";
  }
}
