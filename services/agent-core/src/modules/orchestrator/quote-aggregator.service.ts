import { Injectable, Logger } from "@nestjs/common";
import { Quote, QuoteStatus, CreateQuoteRequest } from "./types";

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

    // TODO: Insert into database (agent_quotes table)
    const quote: Quote = {
      id: this.generateId(),
      sessionId: request.sessionId,
      vendorId: request.vendorId,
      vendorType: request.vendorType,
      vendorName: request.vendorName,
      vendorPhone: request.vendorPhone,
      offerData: request.offerData,
      status: "received",
      priceAmount: request.priceAmount,
      priceCurrency: request.priceCurrency ?? "RWF",
      estimatedTimeMinutes: request.estimatedTimeMinutes,
      notes: request.notes,
      receivedAt: now,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    return quote;
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

    // TODO: Query database
    return [];
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

    // TODO: Update database
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

    // TODO: Query database for quotes where expires_at < now() and status = 'pending'
    // Update their status to 'expired'
    const expiredCount = 0;

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

  /**
   * Generate a unique quote ID
   * 
   * @returns UUID string
   */
  private generateId(): string {
    // Use native crypto.randomUUID() for standards compliance
    return crypto.randomUUID();
  }
}
