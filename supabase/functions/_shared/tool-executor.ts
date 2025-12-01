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
        case "whatsapp":
          result = await this.executeWhatsAppTool(tool, inputs, context);
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
      
      // Marketplace tools
      case "search_listings":
        return await this.searchMarketplaceListings(inputs);
      
      case "create_listing":
        return await this.createMarketplaceListing(inputs, context);
      
      case "search_businesses":
        return await this.searchBusinessDirectory(inputs);
      
      case "get_nearby_listings":
        return await this.getNearbyListings(inputs, context);
      
      default:
        // Generic table query
        return await this.genericTableQuery(tableName, inputs);
    }
  }

  /**
   * Search marketplace listings
   */
  private async searchMarketplaceListings(inputs: Record<string, unknown>): Promise<unknown> {
    const query = inputs.query as string || "";
    const category = inputs.category as string;
    const priceMin = inputs.price_min as number;
    const priceMax = inputs.price_max as number;
    const condition = inputs.condition as string;

    let dbQuery = this.supabase
      .from("marketplace_listings")
      .select(`
        id, product_name, description, price, category, condition, location,
        seller_phone, created_at, photos
      `)
      .eq("status", "active")
      .limit(15);

    if (query) {
      // Escape special characters for LIKE queries to prevent injection
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      dbQuery = dbQuery.or(`product_name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`);
    }

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    if (priceMin) {
      dbQuery = dbQuery.gte("price", priceMin);
    }

    if (priceMax) {
      dbQuery = dbQuery.lte("price", priceMax);
    }

    if (condition) {
      dbQuery = dbQuery.eq("condition", condition);
    }

    const { data, error } = await dbQuery.order("created_at", { ascending: false });

    if (error) {
      console.error("Marketplace search error:", error);
      // Return empty results instead of throwing
      return {
        count: 0,
        listings: [],
        message: "Search completed - no matching listings found",
      };
    }

    return {
      count: data?.length || 0,
      listings: data?.map(l => ({
        id: l.id,
        title: l.product_name,
        description: l.description?.slice(0, 100) + (l.description?.length > 100 ? "..." : ""),
        price: `${l.price} RWF`,
        category: l.category,
        condition: l.condition,
        location: l.location,
        // Mask seller phone for privacy
        seller_contact: l.seller_phone ? `wa.me/${this.formatPhoneForWhatsApp(l.seller_phone)}` : null,
        photos: l.photos?.slice(0, 3),
      })) || [],
    };
  }

  /**
   * Sanitize search query to prevent SQL injection in LIKE patterns
   */
  private sanitizeSearchQuery(query: string): string {
    // Escape special characters used in PostgreSQL LIKE patterns
    return query
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent
      .replace(/_/g, '\\_')    // Escape underscore
      .replace(/'/g, "''")     // Escape single quotes
      .slice(0, 100);          // Limit length to prevent DoS
  }

  /**
   * Format phone number for WhatsApp URL (remove non-digit characters except leading +)
   */
  private formatPhoneForWhatsApp(phone: string): string {
    if (!phone) return '';
    // Keep only digits, removing + prefix and any other characters
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Create a new marketplace listing
   */
  private async createMarketplaceListing(
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const title = inputs.title as string;
    const description = inputs.description as string;
    const price = inputs.price as number;
    const category = inputs.category as string;
    const condition = inputs.condition as string || "used";
    const location = inputs.location as string;
    const negotiable = inputs.negotiable as boolean || true;

    // Get user's phone number for seller contact
    const { data: user } = await this.supabase
      .from("whatsapp_users")
      .select("phone_number")
      .eq("id", context.userId)
      .single();

    const { data, error } = await this.supabase
      .from("marketplace_listings")
      .insert({
        product_name: title,
        description,
        price,
        category,
        condition,
        location,
        negotiable,
        seller_phone: user?.phone_number,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create listing error:", error);
      return {
        success: false,
        error: "Failed to create listing. Please try again.",
      };
    }

    return {
      success: true,
      listing_id: data?.id,
      message: `Your listing "${title}" has been created successfully! Buyers can now find it in the marketplace.`,
    };
  }

  /**
   * Get nearby listings based on user's cached location
   */
  private async getNearbyListings(
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const category = inputs.category as string;
    const radiusKm = (inputs.radius_km as number) || 10;
    const limit = (inputs.limit as number) || 10;

    // Get user's cached location
    const { data: user } = await this.supabase
      .from("whatsapp_users")
      .select("location_cache")
      .eq("id", context.userId)
      .single();

    if (!user?.location_cache) {
      return {
        success: false,
        needs_location: true,
        message: "Please share your location first to find nearby listings. Send your GPS location via WhatsApp.",
      };
    }

    // For now, return a simple search without PostGIS distance calculation
    // In production, this would use a proper geospatial query
    let dbQuery = this.supabase
      .from("marketplace_listings")
      .select(`
        id, product_name, description, price, category, condition, location,
        seller_phone, created_at
      `)
      .eq("status", "active")
      .limit(limit);

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    const { data, error } = await dbQuery.order("created_at", { ascending: false });

    if (error) {
      console.error("Nearby listings error:", error);
      return {
        count: 0,
        listings: [],
        user_location: user.location_cache,
      };
    }

    return {
      count: data?.length || 0,
      listings: data?.map(l => ({
        id: l.id,
        title: l.product_name,
        price: `${l.price} RWF`,
        category: l.category,
        location: l.location,
      })) || [],
      user_location: user.location_cache,
      search_radius_km: radiusKm,
    };
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
   * Execute deep search tool (web search integration)
   */
  private async executeDeepSearchTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const query = inputs.query as string;
    
    if (!query) {
      return {
        results: [],
        message: "Query is required for deep search",
      };
    }

    try {
      // Use web search API (Serper, Tavily, or Google Custom Search)
      const searchApiKey = Deno.env.get("SERPER_API_KEY") || Deno.env.get("TAVILY_API_KEY");
      
      if (!searchApiKey) {
        console.warn("No search API key configured, returning placeholder");
        return {
          query,
          results: [],
          message: "Deep search not yet configured (missing API key)",
        };
      }

      // Example: Serper API integration
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": searchApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        query,
        results: data.organic?.slice(0, 5).map((r: any) => ({
          title: r.title,
          snippet: r.snippet,
          link: r.link,
        })) || [],
        message: `Found ${data.organic?.length || 0} results`,
      };
    } catch (error) {
      console.error("Deep search error:", error);
      return {
        query,
        results: [],
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }

  /**
   * Execute MoMo payment tool
   */
  private async executeMoMoTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const phone = inputs.phone as string;
    const amount = inputs.amount as number;
    const currency = (inputs.currency as string) || "RWF";
    const reference = inputs.reference as string || `EASYMO-${Date.now()}`;

    if (!phone || !amount) {
      return {
        success: false,
        error: "Phone number and amount are required",
      };
    }

    try {
      // Check if MoMo API credentials are configured
      const momoApiKey = Deno.env.get("MOMO_API_KEY");
      const momoUserId = Deno.env.get("MOMO_USER_ID");
      const momoApiUser = Deno.env.get("MOMO_API_USER");
      const momoSubscriptionKey = Deno.env.get("MOMO_SUBSCRIPTION_KEY");

      if (!momoApiKey || !momoUserId) {
        console.warn("MoMo API not configured");
        
        // Store pending transaction in database for manual processing
        await this.supabase.from("payment_transactions").insert({
          user_id: context.userId,
          amount,
          currency,
          phone_number: phone,
          reference,
          status: "pending_manual",
          payment_method: "momo",
          metadata: {
            reason: "API not configured",
            initiated_by_agent: context.agentSlug,
          },
        });

        return {
          phone,
          amount,
          currency,
          reference,
          status: "pending_manual",
          message: "Payment request recorded. Our team will process it manually and contact you shortly.",
        };
      }

      // MTN MoMo Collection API integration
      // Generate UUID for transaction
      const transactionId = crypto.randomUUID();

      // Request to pay
      const response = await fetch(
        "https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${momoApiKey}`,
            "X-Reference-Id": transactionId,
            "X-Target-Environment": Deno.env.get("MOMO_ENVIRONMENT") || "sandbox",
            "Ocp-Apim-Subscription-Key": momoSubscriptionKey || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amount.toString(),
            currency,
            externalId: reference,
            payer: {
              partyIdType: "MSISDN",
              partyId: phone.replace(/\D/g, ""), // Strip non-digits
            },
            payerMessage: `Payment for easyMO - ${reference}`,
            payeeNote: `easyMO transaction ${reference}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`MoMo API error: ${response.status} ${await response.text()}`);
      }

      // Store transaction in database
      await this.supabase.from("payment_transactions").insert({
        user_id: context.userId,
        transaction_id: transactionId,
        amount,
        currency,
        phone_number: phone,
        reference,
        status: "pending",
        payment_method: "momo",
        metadata: {
          initiated_by_agent: context.agentSlug,
        },
      });

      return {
        success: true,
        transaction_id: transactionId,
        phone,
        amount,
        currency,
        reference,
        status: "pending",
        message: `Payment request sent to ${phone}. Please approve on your phone.`,
      };
    } catch (error) {
      console.error("MoMo payment error:", error);
      
      // Store failed transaction for audit
      await this.supabase.from("payment_transactions").insert({
        user_id: context.userId,
        amount,
        currency,
        phone_number: phone,
        reference,
        status: "failed",
        payment_method: "momo",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          initiated_by_agent: context.agentSlug,
        },
      });

      return {
        success: false,
        phone,
        amount,
        error: error instanceof Error ? error.message : "Payment failed",
        message: "Payment request failed. Please try again or contact support.",
      };
    }
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
   * Execute WhatsApp tool (contact_seller, etc.)
   */
  private async executeWhatsAppTool(
    tool: AgentTool,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    switch (tool.name) {
      case "contact_seller":
        return await this.executeContactSeller(inputs);
      default:
        return {
          success: false,
          message: `Unknown WhatsApp tool: ${tool.name}`,
        };
    }
  }

  /**
   * Generate WhatsApp link to contact a seller
   */
  private async executeContactSeller(inputs: Record<string, unknown>): Promise<unknown> {
    const listingId = inputs.listing_id as string;
    const customMessage = inputs.message as string;

    if (!listingId) {
      return {
        success: false,
        error: "Listing ID is required",
      };
    }

    // Get listing details
    const { data: listing, error } = await this.supabase
      .from("marketplace_listings")
      .select("product_name, seller_phone, price")
      .eq("id", listingId)
      .single();

    if (error || !listing) {
      return {
        success: false,
        error: "Listing not found",
      };
    }

    if (!listing.seller_phone) {
      return {
        success: false,
        error: "Seller contact not available for this listing",
      };
    }

    // Build WhatsApp message
    const defaultMessage = `Hi! I'm interested in your listing "${listing.product_name}" priced at ${listing.price} RWF on easyMO Marketplace.`;
    const message = customMessage || defaultMessage;
    
    // Use utility function to clean phone number and build WhatsApp link
    const cleanPhone = this.formatPhoneForWhatsApp(listing.seller_phone);
    const encodedMessage = encodeURIComponent(message);
    const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    return {
      success: true,
      whatsapp_link: whatsappLink,
      seller_name: "Seller", // Mask actual name for privacy
      listing_title: listing.product_name,
      message: `Click to contact the seller: ${whatsappLink}`,
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
