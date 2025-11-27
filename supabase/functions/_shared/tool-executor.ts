/**
 * AI Agent Tool Executor
 * 
 * Executes tools loaded from database configurations
 * Supports multiple tool types: db, http, external, momo, etc.
 * Validates inputs against JSON schemas
 * Logs all executions for monitoring
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AgentTool } from "./agent-config-loader.ts";

export interface ToolExecutionContext {
  userId: string;
  agentId: string;
  conversationId: string;
  agentSlug: string;
  sessionId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  toolName: string;
  toolType: string;
}

/**
 * ToolExecutor - Executes agent tools with validation and logging
 */
export class ToolExecutor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Execute a tool with given inputs
   */
  async executeTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    console.log(JSON.stringify({
      event: "TOOL_EXECUTION_STARTED",
      toolName: tool.name,
      toolType: tool.tool_type,
      userId: context.userId,
      agentSlug: context.agentSlug,
    }));

    try {
      // 1. Validate inputs against schema
      const validationResult = this.validateInputs(inputs, tool.input_schema);
      if (!validationResult.valid) {
        throw new Error(`Invalid inputs: ${validationResult.errors.join(", ")}`);
      }

      // 2. Execute based on tool type
      let result: unknown;
      switch (tool.tool_type) {
        case "db":
          result = await this.executeDbTool(tool, inputs, context);
          break;
        case "http":
          result = await this.executeHttpTool(tool, inputs, context);
          break;
        case "deep_search":
          result = await this.executeDeepSearchTool(tool, inputs, context);
          break;
        case "momo":
          result = await this.executeMoMoTool(tool, inputs, context);
          break;
        case "location":
          result = await this.executeLocationTool(tool, inputs, context);
          break;
        case "external":
          result = await this.executeExternalTool(tool, inputs, context);
          break;
        default:
          throw new Error(`Unsupported tool type: ${tool.tool_type}`);
      }

      const executionTime = Date.now() - startTime;

      // 3. Log successful execution
      await this.logExecution(tool, inputs, result, context, executionTime, true);

      console.log(JSON.stringify({
        event: "TOOL_EXECUTION_SUCCESS",
        toolName: tool.name,
        executionTime,
      }));

      return {
        success: true,
        data: result,
        executionTime,
        toolName: tool.name,
        toolType: tool.tool_type,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed execution
      await this.logExecution(tool, inputs, null, context, executionTime, false, errorMessage);

      console.error(JSON.stringify({
        event: "TOOL_EXECUTION_FAILED",
        toolName: tool.name,
        error: errorMessage,
        executionTime,
      }));

      return {
        success: false,
        error: errorMessage,
        executionTime,
        toolName: tool.name,
        toolType: tool.tool_type,
      };
    }
  }

  /**
   * Validate inputs against JSON schema
   */
  private validateInputs(
    inputs: Record<string, unknown>,
    schema: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    const required = (schema.required as string[]) || [];
    for (const field of required) {
      if (!(field in inputs)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Basic type checking (can be enhanced with full JSON schema validator)
    const properties = (schema.properties as Record<string, any>) || {};
    for (const [key, value] of Object.entries(inputs)) {
      if (properties[key]) {
        const expectedType = properties[key].type;
        const actualType = typeof value;
        
        // Simple type validation
        if (expectedType === "string" && actualType !== "string") {
          errors.push(`Field ${key} should be string, got ${actualType}`);
        }
        if (expectedType === "number" && actualType !== "number") {
          errors.push(`Field ${key} should be number, got ${actualType}`);
        }
        if (expectedType === "boolean" && actualType !== "boolean") {
          errors.push(`Field ${key} should be boolean, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute database tool (search, query, etc.)
   */
  private async executeDbTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const config = tool.config;
    const tableName = config.table as string;

    if (!tableName) {
      throw new Error("Database tool requires 'table' in config");
    }

    // Build query based on tool name
    switch (tool.name) {
      case "search_jobs":
        return await this.searchJobs(inputs);
      
      case "search_properties":
        return await this.searchProperties(inputs);
      
      case "search_menu_supabase":
        return await this.searchMenu(inputs);
      
      case "search_business_directory":
        return await this.searchBusinessDirectory(inputs);
      
      case "search_produce":
        return await this.searchProduce(inputs);
      
      case "lookup_loyalty":
        return await this.lookupLoyalty(inputs);
      
      default:
        // Generic table query
        return await this.genericTableQuery(tableName, inputs);
    }
  }

  /**
   * Search jobs database
   */
  private async searchJobs(inputs: Record<string, unknown>): Promise<unknown> {
    const query = inputs.query as string || "";
    const location = inputs.location as string;
    const type = inputs.type as string;

    let dbQuery = this.supabase
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .limit(10);

    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (location) {
      dbQuery = dbQuery.eq("location", location);
    }

    if (type) {
      dbQuery = dbQuery.eq("type", type);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data;
  }

  /**
   * Search properties database
   */
  private async searchProperties(inputs: Record<string, unknown>): Promise<unknown> {
    const location = inputs.location as string;
    const minPrice = inputs.min_price as number;
    const maxPrice = inputs.max_price as number;
    const bedrooms = inputs.bedrooms as number;

    let dbQuery = this.supabase
      .from("properties")
      .select("*")
      .eq("status", "available")
      .limit(10);

    if (location) {
      dbQuery = dbQuery.ilike("location", `%${location}%`);
    }

    if (minPrice) {
      dbQuery = dbQuery.gte("price", minPrice);
    }

    if (maxPrice) {
      dbQuery = dbQuery.lte("price", maxPrice);
    }

    if (bedrooms) {
      dbQuery = dbQuery.eq("bedrooms", bedrooms);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data;
  }

  /**
   * Search menu items
   */
  private async searchMenu(inputs: Record<string, unknown>): Promise<unknown> {
    const restaurantId = inputs.restaurant_id as string;
    const query = inputs.query as string || "";
    const filters = inputs.filters as Record<string, boolean> || {};

    let dbQuery = this.supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .limit(20);

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Apply filters
    if (filters.vegan) {
      dbQuery = dbQuery.contains("tags", ["vegan"]);
    }
    if (filters.spicy) {
      dbQuery = dbQuery.contains("tags", ["spicy"]);
    }
    if (filters.halal) {
      dbQuery = dbQuery.contains("tags", ["halal"]);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data;
  }

  /**
   * Search business directory
   */
  private async searchBusinessDirectory(inputs: Record<string, unknown>): Promise<unknown> {
    const query = inputs.query as string || "";
    const category = inputs.category as string;
    const location = inputs.location as string;

    let dbQuery = this.supabase
      .from("business_directory")
      .select("*")
      .eq("is_active", true)
      .limit(15);

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    if (location) {
      dbQuery = dbQuery.ilike("location", `%${location}%`);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data;
  }

  /**
   * Search produce listings
   */
  private async searchProduce(inputs: Record<string, unknown>): Promise<unknown> {
    const query = inputs.query as string || "";
    const category = inputs.category as string;

    let dbQuery = this.supabase
      .from("produce_listings")
      .select("*")
      .eq("status", "available")
      .limit(10);

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data;
  }

  /**
   * Lookup loyalty points
   */
  private async lookupLoyalty(inputs: Record<string, unknown>): Promise<unknown> {
    const phone = inputs.phone as string;

    const { data, error } = await this.supabase
      .from("loyalty_programs")
      .select("*")
      .eq("phone_number", phone)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Generic table query
   */
  private async genericTableQuery(
    tableName: string,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const { data, error } = await this.supabase
      .from(tableName)
      .select("*")
      .limit(10);

    if (error) throw error;
    return data;
  }

  /**
   * Execute HTTP tool (API calls)
   */
  private async executeHttpTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const config = tool.config;
    const endpoint = config.endpoint as string;
    const method = (config.method as string) || "GET";

    if (!endpoint) {
      throw new Error("HTTP tool requires 'endpoint' in config");
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: method !== "GET" ? JSON.stringify(inputs) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Execute deep search tool
   */
  private async executeDeepSearchTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    // Placeholder for deep search implementation
    // Could integrate with Serper, Tavily, or other search APIs
    return {
      query: inputs.query,
      results: [],
      message: "Deep search not yet implemented",
    };
  }

  /**
   * Execute MoMo payment tool
   */
  private async executeMoMoTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    // Placeholder - would integrate with actual MoMo API
    return {
      phone: inputs.phone,
      amount: inputs.amount,
      status: "pending",
      message: "MoMo integration pending",
    };
  }

  /**
   * Execute location tool
   */
  private async executeLocationTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    // Get user's cached location
    const { data: userLocation } = await this.supabase
      .from("whatsapp_users")
      .select("location_cache")
      .eq("id", context.userId)
      .single();

    return {
      userLocation: userLocation?.location_cache,
      inputs,
    };
  }

  /**
   * Execute external tool (Sora, etc.)
   */
  private async executeExternalTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    // Placeholder for external API integrations
    return {
      tool: tool.name,
      inputs,
      message: "External tool execution pending",
    };
  }

  /**
   * Log tool execution to database
   */
  private async logExecution(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    result: unknown,
    context: ToolExecutionContext,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.supabase.from("ai_agent_tool_executions").insert({
        agent_id: context.agentId,
        tool_id: tool.id,
        tool_name: tool.name,
        inputs,
        result: success ? result : null,
        error,
        execution_time_ms: executionTime,
        success,
        user_id: context.userId,
        conversation_id: context.conversationId,
        metadata: {
          tool_type: tool.tool_type,
          agent_slug: context.agentSlug,
        },
      });
    } catch (logError) {
      console.error("Failed to log tool execution:", logError);
      // Don't throw - logging failure shouldn't break tool execution
    }
  }
}
