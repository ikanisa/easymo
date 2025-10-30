import { z } from "zod";

/**
 * Common tool result wrapper with error handling
 */
export const ToolResult = z.object({
  success: z.boolean().describe("Whether tool execution succeeded"),
  data: z.any().optional().describe("Tool result data if successful"),
  error: z.string().optional().describe("Error message if failed"),
  metadata: z.record(z.any()).optional().describe("Additional metadata"),
});
export type TToolResult = z.infer<typeof ToolResult>;

/**
 * Tool execution context with observability
 */
export const ToolContext = z.object({
  correlation_id: z.string().uuid().describe("Request correlation ID for tracing"),
  user_id: z.string().optional().describe("User identifier"),
  session_id: z.string().optional().describe("Session identifier"),
  timestamp: z.string().datetime().describe("Execution timestamp"),
});
export type TToolContext = z.infer<typeof ToolContext>;
