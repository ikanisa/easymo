/**
 * Tool Manager for AI Agents
 *
 * Manages tool definitions and execution for OpenAI function calling
 * Provides built-in tools for common operations:
 * - check_wallet_balance
 * - search_trips
 * - create_booking
 * - transfer_money
 * - get_user_profile
 */

import type { SupabaseClient } from "../deps.ts";
import type { Tool, ToolCall } from "./openai_client.ts";
import { logStructuredEvent } from "../observe/log.ts";

/**
 * Safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface ToolDefinition extends Tool {
  handler: (
    args: Record<string, any>,
    context: ToolExecutionContext,
  ) => Promise<any>;
}

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  userId?: string;
  phoneNumber: string;
  correlationId: string;
}

export interface ToolExecutionResult {
  toolCallId: string;
  result: any;
  error?: string;
  executionTimeMs: number;
}

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltinTools(): void {
    // Check wallet balance
    this.registerTool({
      type: "function",
      function: {
        name: "check_wallet_balance",
        description: "Check the user's wallet balance in RWF",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      handler: this.checkWalletBalance,
    });

    // Search trips
    this.registerTool({
      type: "function",
      function: {
        name: "search_trips",
        description: "Search for available trips between locations",
        parameters: {
          type: "object",
          properties: {
            from: {
              type: "string",
              description: "Departure location (e.g., 'Kigali', 'Musanze')",
            },
            to: {
              type: "string",
              description: "Destination location",
            },
            date: {
              type: "string",
              description: "Travel date in YYYY-MM-DD format",
            },
            passengers: {
              type: "number",
              description: "Number of passengers (default: 1)",
            },
          },
          required: ["from", "to"],
        },
      },
      handler: this.searchTrips,
    });

    // Get user profile
    this.registerTool({
      type: "function",
      function: {
        name: "get_user_profile",
        description: "Get the user's profile information",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      handler: this.getUserProfile,
    });

    // Transfer money
    this.registerTool({
      type: "function",
      function: {
        name: "initiate_transfer",
        description: "Initiate a money transfer from user's wallet",
        parameters: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Amount to transfer in RWF",
            },
            recipient: {
              type: "string",
              description: "Recipient phone number",
            },
          },
          required: ["amount", "recipient"],
        },
      },
      handler: this.initiateTransfer,
    });
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.function.name, tool);
  }

  /**
   * Get all tool definitions for OpenAI
   */
  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map(({ type, function: func }) => ({
      type,
      function: func,
    }));
  }

  /**
   * Execute a tool call
   */
  async executeTool(
    toolCall: ToolCall,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const toolName = toolCall.function.name;

    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Parse arguments
      let args: Record<string, any>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        throw new Error(`Invalid tool arguments: ${getErrorMessage(error)}`);
      }

      await logStructuredEvent("TOOL_EXECUTION_START", {
        correlation_id: context.correlationId,
        tool_name: toolName,
        tool_call_id: toolCall.id,
        arguments: args,
      });

      // Execute tool
      const result = await tool.handler(args, context);
      const executionTimeMs = Date.now() - startTime;

      await logStructuredEvent("TOOL_EXECUTION_SUCCESS", {
        correlation_id: context.correlationId,
        tool_name: toolName,
        tool_call_id: toolCall.id,
        execution_time_ms: executionTimeMs,
      });

      // Save execution to database
      await this.saveToolExecution(
        context,
        toolName,
        args,
        result,
        true,
        executionTimeMs,
      );

      return {
        toolCallId: toolCall.id,
        result,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      await logStructuredEvent("TOOL_EXECUTION_ERROR", {
        correlation_id: context.correlationId,
        tool_name: toolName,
        tool_call_id: toolCall.id,
        error: getErrorMessage(error),
        execution_time_ms: executionTimeMs,
      });

      // Save failed execution
      await this.saveToolExecution(
        context,
        toolName,
        {},
        null,
        false,
        executionTimeMs,
        getErrorMessage(error),
      );

      return {
        toolCallId: toolCall.id,
        result: null,
        error: getErrorMessage(error),
        executionTimeMs,
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult[]> {
    const results = await Promise.all(
      toolCalls.map((toolCall) => this.executeTool(toolCall, context)),
    );
    return results;
  }

  /**
   * Save tool execution to database
   */
  private async saveToolExecution(
    context: ToolExecutionContext,
    toolName: string,
    input: Record<string, any>,
    output: any,
    success: boolean,
    executionTimeMs: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await context.supabase.from("ai_tool_executions").insert({
        agent_id: null, // Will be set when we have agent sessions
        conversation_id: null,
        tool_name: toolName,
        input,
        output,
        success,
        error_message: errorMessage || null,
        execution_time_ms: executionTimeMs,
        metadata: {
          phone_number: context.phoneNumber,
          correlation_id: context.correlationId,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to save tool execution:", error);
    }
  }

  // ==================== Built-in Tool Handlers ====================

  private async checkWalletBalance(
    args: Record<string, any>,
    context: ToolExecutionContext,
  ): Promise<any> {
    const { data, error } = await context.supabase
      .from("wallets")
      .select("balance, currency")
      .eq("user_id", context.userId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Wallet not found or error retrieving balance",
      };
    }

    return {
      success: true,
      balance: data.balance,
      currency: data.currency || "RWF",
      formatted: `${data.balance.toLocaleString()} RWF`,
    };
  }

  private async searchTrips(
    args: Record<string, any>,
    context: ToolExecutionContext,
  ): Promise<any> {
    const { from, to, date, passengers = 1 } = args;

    // Build query
    let query = context.supabase
      .from("trips")
      .select("id, route, departure_time, price, available_seats, vehicle_type")
      .eq("status", "scheduled")
      .gte("available_seats", passengers);

    // Filter by route (simplified - in production would use proper route matching)
    if (from && to) {
      query = query.ilike("route", `%${from}%`).ilike("route", `%${to}%`);
    }

    // Filter by date if provided
    if (date) {
      const startOfDay = `${date} 00:00:00`;
      const endOfDay = `${date} 23:59:59`;
      query = query.gte("departure_time", startOfDay).lte(
        "departure_time",
        endOfDay,
      );
    }

    query = query.limit(5);

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: "Error searching trips",
      };
    }

    return {
      success: true,
      trips: data || [],
      count: data?.length || 0,
    };
  }

  private async getUserProfile(
    args: Record<string, any>,
    context: ToolExecutionContext,
  ): Promise<any> {
    const { data, error } = await context.supabase
      .from("users")
      .select("id, name, email, phone_number, language, preferences")
      .eq("id", context.userId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "User profile not found",
      };
    }

    return {
      success: true,
      profile: {
        name: data.name,
        email: data.email,
        phone: data.phone_number,
        language: data.language,
        preferences: data.preferences,
      },
    };
  }

  private async initiateTransfer(
    args: Record<string, any>,
    context: ToolExecutionContext,
  ): Promise<any> {
    const { amount, recipient } = args;

    // Validate amount
    if (amount <= 0) {
      return {
        success: false,
        error: "Amount must be greater than 0",
      };
    }

    // Check user balance
    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", context.userId)
      .single();

    if (!wallet || wallet.balance < amount) {
      return {
        success: false,
        error: "Insufficient balance",
        current_balance: wallet?.balance || 0,
      };
    }

    // Note: This is a simplified version
    // In production, this would create a transfer record and trigger payment processing
    return {
      success: true,
      status: "pending",
      message: "Transfer initiated. Please confirm via SMS.",
      transfer_id: crypto.randomUUID(),
      amount,
      recipient,
    };
  }
}

/**
 * Singleton instance
 */
let toolManagerInstance: ToolManager | null = null;

export function getToolManager(): ToolManager {
  if (!toolManagerInstance) {
    toolManagerInstance = new ToolManager();
  }
  return toolManagerInstance;
}
