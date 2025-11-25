/**
 * WhatsApp-Specific Tools for AI Agents
 * 
 * Provides tools that agents can use to interact with WhatsApp Business API
 * and EasyMO backend services
 * 
 * ADDITIVE ONLY - New tools for agent system
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { Tool } from "./openai_client.ts";
import { sendText, sendInteractiveList, sendInteractiveButtons } from "../rpc/whatsapp.ts";
import { logStructuredEvent } from "../observe/log.ts";

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  userId?: string;
  phoneNumber?: string;
  correlationId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: any, context: ToolExecutionContext) => Promise<any>;
}

/**
 * Tool Manager for registering and executing tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    // User information
    this.register({
      name: "get_user_info",
      description: "Get user profile information including name, language preference, and account details",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User ID not available" };
        }

        const { data, error } = await context.supabase
          .from("users")
          .select("id, name, email, phone_number, language, created_at, last_active_at")
          .eq("id", context.userId)
          .single();

        if (error) return { error: error.message };

        return {
          user: {
            id: data.id,
            name: data.name,
            email: data.email,
            phoneNumber: data.phone_number,
            language: data.language || "en",
            memberSince: data.created_at,
            lastActive: data.last_active_at,
          },
        };
      },
    });

    // Wallet balance
    this.register({
      name: "get_wallet_balance",
      description: "Check user's wallet balance",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User ID not available" };
        }

        const { data, error } = await context.supabase
          .from("wallets")
          .select("balance, currency, last_transaction_at")
          .eq("user_id", context.userId)
          .single();

        if (error) return { error: error.message };

        return {
          balance: data.balance,
          currency: data.currency || "RWF",
          lastTransaction: data.last_transaction_at,
          formattedBalance: `${data.balance.toLocaleString()} ${data.currency || "RWF"}`,
        };
      },
    });

    // Transaction history
    this.register({
      name: "get_transaction_history",
      description: "Get recent wallet transactions",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of transactions to return (default: 5, max: 20)",
          },
        },
        required: [],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User ID not available" };
        }

        const limit = Math.min(args.limit || 5, 20);

        const { data, error } = await context.supabase
          .from("wallet_transactions")
          .select("id, type, amount, currency, status, description, created_at")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) return { error: error.message };

        return {
          transactions: data.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            description: tx.description,
            date: tx.created_at,
            formattedAmount: `${tx.type === "debit" ? "-" : "+"}${tx.amount.toLocaleString()} ${tx.currency}`,
          })),
        };
      },
    });

    // Search routes
    this.register({
      name: "search_routes",
      description: "Search for available bus/taxi routes between locations",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description: "Starting location (e.g., 'Kigali', 'Nyabugogo')",
          },
          destination: {
            type: "string",
            description: "Destination location (e.g., 'Gisenyi', 'Musanze')",
          },
          date: {
            type: "string",
            description: "Travel date in YYYY-MM-DD format (optional, defaults to today)",
          },
        },
        required: ["origin", "destination"],
      },
      handler: async (args, context) => {
        const date = args.date || new Date().toISOString().split("T")[0];

        const { data, error } = await context.supabase
          .from("routes")
          .select(`
            id,
            origin,
            destination,
            route_code,
            trips!inner(
              id,
              departure_time,
              arrival_time,
              available_seats,
              price,
              vehicle_type
            )
          `)
          .ilike("origin", `%${args.origin}%`)
          .ilike("destination", `%${args.destination}%`)
          .gte("trips.departure_time", date)
          .limit(10);

        if (error) return { error: error.message };

        if (!data || data.length === 0) {
          return {
            found: false,
            message: `No trips found from ${args.origin} to ${args.destination} on ${date}`,
          };
        }

        return {
          found: true,
          routes: data.map((route: any) => ({
            routeId: route.id,
            origin: route.origin,
            destination: route.destination,
            trips: route.trips.map((trip: any) => ({
              tripId: trip.id,
              departureTime: trip.departure_time,
              arrivalTime: trip.arrival_time,
              availableSeats: trip.available_seats,
              price: `${trip.price.toLocaleString()} RWF`,
              vehicleType: trip.vehicle_type,
            })),
          })),
        };
      },
    });

    // Get trip details
    this.register({
      name: "get_trip_details",
      description: "Get detailed information about a specific trip",
      parameters: {
        type: "object",
        properties: {
          tripId: {
            type: "string",
            description: "Trip ID",
          },
        },
        required: ["tripId"],
      },
      handler: async (args, context) => {
        const { data, error } = await context.supabase
          .from("rides_trips")
          .select(`
            *,
            route:routes(origin, destination, route_code),
            vehicle:vehicles(plate_number, model, total_seats)
          `)
          .eq("id", args.tripId)
          .single();

        if (error) return { error: error.message };

        return {
          trip: {
            id: data.id,
            origin: data.route.origin,
            destination: data.route.destination,
            routeCode: data.route.route_code,
            departureTime: data.departure_time,
            arrivalTime: data.arrival_time,
            price: `${data.price.toLocaleString()} RWF`,
            availableSeats: data.available_seats,
            totalSeats: data.vehicle.total_seats,
            vehicleInfo: `${data.vehicle.model} (${data.vehicle.plate_number})`,
            status: data.status,
          },
        };
      },
    });

    // Check seat availability
    this.register({
      name: "check_seat_availability",
      description: "Check available seats for a trip",
      parameters: {
        type: "object",
        properties: {
          tripId: {
            type: "string",
            description: "Trip ID",
          },
        },
        required: ["tripId"],
      },
      handler: async (args, context) => {
        const { data, error } = await context.supabase
          .from("seats")
          .select("seat_number, status, position")
          .eq("trip_id", args.tripId)
          .order("seat_number");

        if (error) return { error: error.message };

        const available = data.filter((s) => s.status === "available");
        const booked = data.filter((s) => s.status === "booked");

        return {
          totalSeats: data.length,
          availableCount: available.length,
          bookedCount: booked.length,
          availableSeats: available.map((s) => ({
            seatNumber: s.seat_number,
            position: s.position,
          })),
        };
      },
    });

    // Create booking
    this.register({
      name: "book_trip",
      description: "Book a trip for the user",
      parameters: {
        type: "object",
        properties: {
          tripId: {
            type: "string",
            description: "Trip ID to book",
          },
          seatNumbers: {
            type: "array",
            items: { type: "string" },
            description: "Seat numbers to book (e.g., ['A1', 'A2'])",
          },
          passengerName: {
            type: "string",
            description: "Passenger name",
          },
          passengerPhone: {
            type: "string",
            description: "Passenger phone number",
          },
        },
        required: ["tripId", "seatNumbers"],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User authentication required" };
        }

        // Get trip price
        const { data: tripData, error: tripError } = await context.supabase
          .from("rides_trips")
          .select("price")
          .eq("id", args.tripId)
          .single();

        if (tripError) return { error: tripError.message };

        const totalAmount = tripData.price * args.seatNumbers.length;

        // Check wallet balance
        const { data: wallet, error: walletError } = await context.supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", context.userId)
          .single();

        if (walletError) return { error: walletError.message };

        if (wallet.balance < totalAmount) {
          return {
            error: "Insufficient balance",
            required: totalAmount,
            available: wallet.balance,
            shortfall: totalAmount - wallet.balance,
          };
        }

        // Create booking
        const { data: booking, error: bookingError } = await context.supabase
          .from("bookings")
          .insert({
            user_id: context.userId,
            trip_id: args.tripId,
            seats: args.seatNumbers,
            passenger_name: args.passengerName || "Guest",
            passenger_phone: args.passengerPhone || context.phoneNumber,
            total_amount: totalAmount,
            payment_status: "pending",
            status: "confirmed",
          })
          .select()
          .single();

        if (bookingError) return { error: bookingError.message };

        await logStructuredEvent("BOOKING_CREATED", {
          correlation_id: context.correlationId,
          booking_id: booking.id,
          trip_id: args.tripId,
          seats: args.seatNumbers.length,
          amount: totalAmount,
        });

        return {
          success: true,
          booking: {
            id: booking.id,
            tripId: args.tripId,
            seats: args.seatNumbers,
            totalAmount: `${totalAmount.toLocaleString()} RWF`,
            status: booking.status,
            bookingReference: booking.id.slice(0, 8).toUpperCase(),
          },
        };
      },
    });

    // Get booking history
    this.register({
      name: "get_booking_history",
      description: "Get user's recent bookings",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of bookings to return (default: 5, max: 10)",
          },
        },
        required: [],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User ID not available" };
        }

        const limit = Math.min(args.limit || 5, 10);

        const { data, error } = await context.supabase
          .from("bookings")
          .select(`
            id,
            total_amount,
            status,
            created_at,
            trip:trips(
              departure_time,
              route:routes(origin, destination)
            )
          `)
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) return { error: error.message };

        return {
          bookings: data.map((booking) => ({
            id: booking.id,
            reference: booking.id.slice(0, 8).toUpperCase(),
            origin: booking.trip.route.origin,
            destination: booking.trip.route.destination,
            departureTime: booking.trip.departure_time,
            amount: `${booking.total_amount.toLocaleString()} RWF`,
            status: booking.status,
            bookedAt: booking.created_at,
          })),
        };
      },
    });

    // Search help articles
    this.register({
      name: "search_help_articles",
      description: "Search help articles and FAQs",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
        },
        required: ["query"],
      },
      handler: async (args, context) => {
        const { data, error } = await context.supabase
          .from("help_articles")
          .select("id, title, content, category")
          .textSearch("content", args.query)
          .limit(5);

        if (error) return { error: error.message };

        return {
          articles: data.map((article) => ({
            id: article.id,
            title: article.title,
            category: article.category,
            snippet: article.content.slice(0, 200) + "...",
          })),
        };
      },
    });

    // Create support ticket
    this.register({
      name: "create_support_ticket",
      description: "Create a support ticket for complex issues",
      parameters: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "Ticket subject",
          },
          description: {
            type: "string",
            description: "Detailed description of the issue",
          },
          category: {
            type: "string",
            enum: ["technical", "billing", "booking", "account", "other"],
            description: "Issue category",
          },
        },
        required: ["subject", "description"],
      },
      handler: async (args, context) => {
        if (!context.userId) {
          return { error: "User authentication required" };
        }

        const { data, error } = await context.supabase
          .from("support_tickets")
          .insert({
            user_id: context.userId,
            subject: args.subject,
            description: args.description,
            category: args.category || "other",
            status: "open",
            priority: "medium",
          })
          .select()
          .single();

        if (error) return { error: error.message };

        await logStructuredEvent("SUPPORT_TICKET_CREATED", {
          correlation_id: context.correlationId,
          ticket_id: data.id,
          category: args.category,
        });

        return {
          success: true,
          ticket: {
            id: data.id,
            reference: `TKT-${data.id.slice(0, 6).toUpperCase()}`,
            subject: data.subject,
            status: data.status,
            createdAt: data.created_at,
            message: "Your ticket has been created. Our team will respond within 24 hours.",
          },
        };
      },
    });

    // Marketplace search
    this.register({
      name: "search_marketplace",
      description: "Search for products in the marketplace",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for products",
          },
          category: {
            type: "string",
            description: "Product category filter (optional)",
          },
          maxPrice: {
            type: "number",
            description: "Maximum price filter (optional)",
          },
        },
        required: ["query"],
      },
      handler: async (args, context) => {
        let query = context.supabase
          .from("marketplace_products")
          .select("id, name, description, price, category, image_url, vendor:vendors(name)")
          .textSearch("name", args.query)
          .eq("status", "active");

        if (args.category) {
          query = query.eq("category", args.category);
        }

        if (args.maxPrice) {
          query = query.lte("price", args.maxPrice);
        }

        const { data, error } = await query.limit(10);

        if (error) return { error: error.message };

        return {
          products: data.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description?.slice(0, 100),
            price: `${product.price.toLocaleString()} RWF`,
            category: product.category,
            vendor: product.vendor.name,
          })),
        };
      },
    });

    logStructuredEvent("TOOL_REGISTRY_INITIALIZED", {
      tool_count: this.tools.size,
    });
  }

  /**
   * Register a tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool definition for OpenAI format
   */
  async getToolDefinition(name: string): Promise<Tool | null> {
    const tool = this.tools.get(name);
    if (!tool) return null;

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  /**
   * Execute a tool
   */
  async executeTool(
    name: string,
    args: any,
    context: ToolExecutionContext,
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const startTime = Date.now();

    try {
      const result = await tool.handler(args, context);
      const latencyMs = Date.now() - startTime;

      await logStructuredEvent("TOOL_EXECUTION_SUCCESS", {
        correlation_id: context.correlationId,
        tool_name: name,
        latency_ms: latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      await logStructuredEvent("TOOL_EXECUTION_ERROR", {
        correlation_id: context.correlationId,
        tool_name: name,
        error: error instanceof Error ? error.message : String(error),
        latency_ms: latencyMs,
      });

      throw error;
    }
  }

  /**
   * Get all registered tools
   */
  getAllTools(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Singleton instance
 */
let toolManagerInstance: ToolRegistry | null = null;

export function getToolManager(): ToolRegistry {
  if (!toolManagerInstance) {
    toolManagerInstance = new ToolRegistry();
  }
  return toolManagerInstance;
}
