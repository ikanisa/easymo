import { Injectable, Logger } from "@nestjs/common";
import { SessionManagerService } from "./session-manager.service";
import { QuoteAggregatorService } from "./quote-aggregator.service";
import {
  CreateSessionRequest,
  NegotiationResult,
  VendorContactInfo,
  FlowType,
} from "./types";

/**
 * Agent Orchestrator Service
 * 
 * Main orchestration service for AI-agent-first negotiation flows.
 * Coordinates the entire negotiation lifecycle:
 * 1. Create session with 5-minute window
 * 2. Identify and contact vendors
 * 3. Collect quotes in parallel
 * 4. Present best options to user
 * 5. Handle user selection
 * 
 * @service OrchestratorService
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly quoteAggregator: QuoteAggregatorService,
  ) {}

  /**
   * Start a negotiation session
   * 
   * Main entry point for all agent-driven flows.
   * 
   * @param request - Session creation parameters
   * @returns Created session with initial status
   * 
   * @example
   * ```typescript
   * const session = await orchestrator.startNegotiation({
   *   userId: "user-123",
   *   flowType: "nearby_drivers",
   *   requestData: {
   *     pickup: { lat: -1.9441, lng: 30.0619 },
   *     dropoff: { lat: -1.9536, lng: 30.0909 },
   *   },
   *   windowMinutes: 5,
   * });
   * ```
   */
  async startNegotiation(request: CreateSessionRequest): Promise<NegotiationResult> {
    this.logger.log({
      event: "NEGOTIATION_START",
      flowType: request.flowType,
      windowMinutes: request.windowMinutes ?? 5,
    });

    // Create session
    const session = await this.sessionManager.createSession(request);

    // Find vendors based on flow type
    const vendors = await this.findVendors(request.flowType, request.requestData);

    this.logger.log({
      event: "VENDORS_FOUND",
      sessionId: session.id,
      vendorCount: vendors.length,
    });

    // TODO: Contact vendors in parallel
    // TODO: Set up quote collection
    // TODO: Start deadline monitoring

    // For now, return initial result
    return {
      sessionId: session.id,
      status: session.status,
      quotesReceived: 0,
      allQuotes: [],
      timeElapsed: 0,
      timedOut: false,
    };
  }

  /**
   * Get negotiation results
   * 
   * Retrieves current state of negotiation session.
   * 
   * @param sessionId - Session identifier
   * @returns Current negotiation results
   */
  async getNegotiationResult(sessionId: string): Promise<NegotiationResult> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const quotes = await this.quoteAggregator.getSessionQuotes(sessionId);
    const bestQuote = quotes.length > 0 ? quotes[0] : undefined;
    const timeElapsed = Date.now() - session.startedAt.getTime();
    const timedOut = session.status === "timeout";

    return {
      sessionId: session.id,
      status: session.status,
      quotesReceived: quotes.length,
      bestQuote,
      allQuotes: quotes,
      timeElapsed,
      timedOut,
    };
  }

  /**
   * Complete a negotiation by accepting a quote
   * 
   * @param sessionId - Session identifier
   * @param quoteId - Selected quote identifier
   */
  async completeNegotiation(sessionId: string, quoteId: string): Promise<void> {
    this.logger.log({
      event: "NEGOTIATION_COMPLETED",
      sessionId,
      quoteId,
    });

    // Accept the selected quote
    await this.quoteAggregator.acceptQuote(quoteId, sessionId);

    // Update session status
    await this.sessionManager.updateSessionStatus(sessionId, "completed", {
      selectedQuoteId: quoteId,
      completedAt: new Date().toISOString(),
    });

    // TODO: Notify selected vendor
    // TODO: Create trip/booking/order based on flow type
  }

  /**
   * Cancel a negotiation session
   * 
   * @param sessionId - Session identifier
   * @param reason - Cancellation reason
   */
  async cancelNegotiation(sessionId: string, reason?: string): Promise<void> {
    this.logger.log({
      event: "NEGOTIATION_CANCELLED",
      sessionId,
      reason,
    });

    await this.sessionManager.cancelSession(sessionId, reason);

    // TODO: Notify vendors
  }

  /**
   * Find vendors for a flow type
   * 
   * This is a placeholder that will be implemented based on flow type:
   * - nearby_drivers: Query match_drivers_for_trip_v2
   * - nearby_pharmacies: Query marketplace_entries with type='pharmacy'
   * - etc.
   * 
   * @param flowType - Type of flow
   * @param requestData - Request parameters
   * @returns Array of vendor contact information
   */
  private async findVendors(
    flowType: FlowType,
    requestData: Record<string, unknown>,
  ): Promise<VendorContactInfo[]> {
    this.logger.debug({
      event: "FIND_VENDORS",
      flowType,
    });

    // TODO: Implement vendor discovery based on flow type
    // For now, return empty array
    return [];
  }

  /**
   * Send quote request to vendor
   * 
   * Sends WhatsApp message to vendor requesting a quote.
   * 
   * @param sessionId - Session identifier
   * @param vendor - Vendor contact information
   * @param requestDetails - Details of the request
   */
  private async sendQuoteRequest(
    sessionId: string,
    vendor: VendorContactInfo,
    requestDetails: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log({
      event: "QUOTE_REQUEST_SENT",
      sessionId,
      vendorId: vendor.id,
      vendorType: vendor.type,
    });

    // TODO: Send WhatsApp message via wa-webhook
    // Message format depends on vendor type and flow
  }

  /**
   * Handle incoming quote response from vendor
   * 
   * Called when vendor responds to quote request.
   * 
   * @param sessionId - Session identifier
   * @param vendorId - Vendor identifier
   * @param quoteData - Quote details
   */
  async handleVendorResponse(
    sessionId: string,
    vendorId: string,
    quoteData: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log({
      event: "VENDOR_RESPONSE_RECEIVED",
      sessionId,
      vendorId,
    });

    // TODO: Parse vendor response
    // TODO: Add quote to session
    // TODO: Check if we have enough quotes
    // TODO: Update session status if ready to present
  }

  /**
   * Monitor expiring sessions
   * 
   * Background task that checks for sessions nearing deadline.
   * Sends "need more time?" prompts to users.
   * 
   * Should be called by a scheduled job every minute.
   */
  async monitorExpiringSessions(): Promise<void> {
    const expiringSessions = await this.sessionManager.getExpiringSessions(1);

    for (const session of expiringSessions) {
      this.logger.log({
        event: "SESSION_EXPIRING_SOON",
        sessionId: session.id,
        minutesRemaining: Math.floor(
          (session.deadlineAt.getTime() - Date.now()) / 60000,
        ),
      });

      // TODO: Send WhatsApp message to user
      // "I have X quotes so far. Need more time?"
      // If user says yes, extend deadline
      // If user says no or no response, proceed with available quotes
    }
  }

  /**
   * Timeout expired sessions
   * 
   * Background task that marks sessions as timed out.
   * 
   * Should be called by a scheduled job every minute.
   */
  async timeoutExpiredSessions(): Promise<void> {
    // TODO: Query for sessions past deadline with status 'searching' or 'negotiating'
    // Mark them as 'timeout'
    // Notify users with partial results if any quotes available
  }
}
