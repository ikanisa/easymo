/**
 * Tool execution dispatcher
 * Routes tool calls to appropriate Supabase functions
 */

export type ToolMetadata = {
  correlation_id?: string;
  user_id?: string;
  session_id?: string;
};

/**
 * Call a Supabase Edge Function
 */
async function callSupabaseFunction(
  functionName: string,
  args: any,
  metadata: ToolMetadata
): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration missing");
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  console.log("ai.tool.call_function", {
    correlation_id: metadata.correlation_id,
    function_name: functionName,
    url,
    timestamp: new Date().toISOString(),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      "x-correlation-id": metadata.correlation_id || "",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Function call failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Call a tool by name with provided arguments
 * This is a central dispatcher that routes to specific implementations
 */
export async function callTool(
  name: string,
  args: any,
  metadata: ToolMetadata = {}
): Promise<any> {
  console.log("ai.tool.dispatch", {
    correlation_id: metadata.correlation_id,
    tool_name: name,
    timestamp: new Date().toISOString(),
  });

  try {
    switch (name) {
      case "create_voucher":
        return await callSupabaseFunction("ai-create-voucher", args, metadata);

      case "lookup_customer":
        return await callSupabaseFunction("ai-lookup-customer", args, metadata);

      case "redeem_voucher":
        return await callSupabaseFunction("ai-redeem-voucher", args, metadata);

      case "void_voucher":
        return await callSupabaseFunction("ai-void-voucher", args, metadata);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error("ai.tool.call_error", {
      correlation_id: metadata.correlation_id,
      tool_name: name,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
