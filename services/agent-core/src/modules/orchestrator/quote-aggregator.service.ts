import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { CreateQuoteRequest, Quote, QuoteStatus } from "./types";

/**
 * Quote Aggregator Service
 * 
 * Collects, aggregates, and ranks quotes from multiple vendors.
 * Handles quote expiration and vendor response tracking.
 * 
 * @service QuoteAggregatorService
 */
@Injectable()
export class QuoteAggregatorService {
  private readonly logger = new Logger(QuoteAggregatorService.name);
  private readonly DEFAULT_QUOTE_EXPIRY_MINUTES = 10;
  private readonly supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Add a new quote to a session
   * 
   * @param request - Quote creation parameters
   * @returns Created quote
   * 
   * @throws Error if session not found
   * @throws Error if session has ended
   */
  async addQuote(request: CreateQuoteRequest): Promise<Quote> {
    const now = new Date();
    const expiresAt = request.expiresInMinutes
      ? new Date(now.getTime() + request.expiresInMinutes * 60 * 1000)
      : new Date(now.getTime() + this.DEFAULT_QUOTE_EXPIRY_MINUTES * 60 * 1000);

    this.logger.log({
      event: "QUOTE_ADDED",
      sessionId: request.sessionId,
      vendorType: request.vendorType,
      priceAmount: request.priceAmount,
      estimatedTimeMinutes: request.estimatedTimeMinutes,
    });

    const { data, error } = await this.supabase
      .from("agent_quotes")
      .insert({
        session_id: request.sessionId,
        vendor_id: request.vendorId,
        vendor_type: request.vendorType,
        vendor_name: request.vendorName,
        vendor_phone: request.vendorPhone,
        offer_data: request.offerData,
        status: "received",
        price_amount: request.priceAmount,
        price_currency: request.priceCurrency || "RWF",
        estimated_time_minutes: request.estimatedTimeMinutes,
        notes: request.notes,
        received_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error({
        event: "QUOTE_ADD_FAILED",
        error: error.message,
        sessionId: request.sessionId,
      });
      throw new Error(`Failed to add quote: ${error.message}`);
    }

    return {
      id: data.id,
      sessionId: data.session_id,
      vendorId: data.vendor_id,
      vendorType: data.vendor_type,
      vendorName: data.vendor_name,
      vendorPhone: data.vendor_phone,
      offerData: data.offer_data || {},
      status: data.status,
      priceAmount: data.price_amount,
      priceCurrency: data.price_currency,
      estimatedTimeMinutes: data.estimated_time_minutes,
      notes: data.notes,
      receivedAt: new Date(data.received_at),
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get all quotes for a session
   * 
   * @param sessionId - Session identifier
   * @returns Array of quotes
   */
  async getSessionQuotes(sessionId: string): Promise<Quote[]> {
    this.logger.debug({
      event: "GET_SESSION_QUOTES",
      sessionId,
    });

    const { data, error } = await this.supabase
      .from("agent_quotes")
      .select("*")
      .eq("session_id", sessionId)
      .order("received_at", { ascending: true });

    if (error) {
      this.logger.error({
        event: "GET_QUOTES_FAILED",
        error: error.message,
        sessionId,
      });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      vendorId: row.vendor_id,
      vendorType: row.vendor_type,
      vendorName: row.vendor_name,
      vendorPhone: row.vendor_phone,
      offerData: row.offer_data || {},
      status: row.status,
      priceAmount: row.price_amount,
      priceCurrency: row.price_currency,
      estimatedTimeMinutes: row.estimated_time_minutes,
      notes: row.notes,
      receivedAt: new Date(row.received_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Get best quotes for presentation to user
   * 
   * Ranks by:
   * 1. Price (lower is better)
   * 2. Estimated time (faster is better)
   * 3. Vendor rating (if available)
   * 
   * @param sessionId - Session identifier
   * @param limit - Maximum number of quotes to return (default 3)
   * @returns Top ranked quotes
   */
  async getBestQuotes(sessionId: string, limit: number = 3): Promise<Quote[]> {
    const quotes = await this.getSessionQuotes(sessionId);

    // Filter out expired and rejected quotes
    const validQuotes = quotes.filter(
      (q) =>
        q.status === "received" &&
        (!q.expiresAt || q.expiresAt > new Date()),
    );

    // Sort by price (ascending) and time (ascending)
    const ranked = validQuotes.sort((a, b) => {
      // Compare price first
      if (a.priceAmount && b.priceAmount) {
        const priceDiff = a.priceAmount - b.priceAmount;
        if (priceDiff !== 0) return priceDiff;
      }

      // If prices equal or missing, compare time
      if (a.estimatedTimeMinutes && b.estimatedTimeMinutes) {
        return a.estimatedTimeMinutes - b.estimatedTimeMinutes;
      }

      return 0;
    });

    this.logger.log({
      event: "BEST_QUOTES_RANKED",
      sessionId,
      totalQuotes: quotes.length,
      validQuotes: validQuotes.length,
      returning: Math.min(limit, ranked.length),
    });

    return ranked.slice(0, limit);
  }

  /**
   * Update quote status
   * 
   * @param quoteId - Quote identifier
   * @param status - New status
   */
  async updateQuoteStatus(quoteId: string, status: QuoteStatus): Promise<void> {
    this.logger.log({
      event: "QUOTE_STATUS_UPDATE",
      quoteId,
      newStatus: status,
    });

    const { error } = await this.supabase
      .from("agent_quotes")
      .update({ status })
      .eq("id", quoteId);

    if (error) {
      this.logger.error({
        event: "QUOTE_UPDATE_FAILED",
        error: error.message,
        quoteId,
      });
      throw new Error(`Failed to update quote: ${error.message}`);
    }
  }

  /**
   * Accept a quote (user selection)
   * 
   * @param quoteId - Quote identifier
   * @param sessionId - Session identifier
   */
  async acceptQuote(quoteId: string, sessionId: string): Promise<void> {
    this.logger.log({
      event: "QUOTE_ACCEPTED",
      quoteId,
      sessionId,
    });

    // Update this quote to accepted
    await this.updateQuoteStatus(quoteId, "accepted");

    // Reject all other quotes in the session
    const allQuotes = await this.getSessionQuotes(sessionId);
    for (const quote of allQuotes) {
      if (quote.id !== quoteId && quote.status === "received") {
        await this.updateQuoteStatus(quote.id, "rejected");
      }
    }
  }

  /**
   * Expire old quotes
   * 
   * Called by background worker to clean up
   * 
   * @returns Number of quotes expired
   */
  async expireOldQuotes(): Promise<number> {
    this.logger.debug({
      event: "EXPIRE_OLD_QUOTES_START",
    });

    const { data, error } = await this.supabase
      .from("agent_quotes")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      this.logger.error({
        event: "EXPIRE_QUOTES_FAILED",
        error: error.message,
      });
      return 0;
    }

    const expiredCount = data?.length || 0;

    if (expiredCount > 0) {
      this.logger.log({
        event: "QUOTES_EXPIRED",
        count: expiredCount,
      });
    }

    return expiredCount;
  }

  /**
   * Get quote statistics for a session
   * 
   * @param sessionId - Session identifier
   * @returns Statistics object
   */
  async getQuoteStats(sessionId: string): Promise<{
    total: number;
    received: number;
    pending: number;
    expired: number;
    avgPrice?: number;
    avgTime?: number;
  }> {
    const quotes = await this.getSessionQuotes(sessionId);

    const stats = {
      total: quotes.length,
      received: quotes.filter((q) => q.status === "received").length,
      pending: quotes.filter((q) => q.status === "pending").length,
      expired: quotes.filter((q) => q.status === "expired").length,
      avgPrice: undefined as number | undefined,
      avgTime: undefined as number | undefined,
    };

    // Calculate averages
    const quotesWithPrice = quotes.filter((q) => q.priceAmount !== undefined);
    if (quotesWithPrice.length > 0) {
      stats.avgPrice =
        quotesWithPrice.reduce((sum, q) => sum + (q.priceAmount ?? 0), 0) /
        quotesWithPrice.length;
    }

    const quotesWithTime = quotes.filter(
      (q) => q.estimatedTimeMinutes !== undefined,
    );
    if (quotesWithTime.length > 0) {
      stats.avgTime =
        quotesWithTime.reduce((sum, q) => sum + (q.estimatedTimeMinutes ?? 0), 0) /
        quotesWithTime.length;
    }

    return stats;
  }
}
