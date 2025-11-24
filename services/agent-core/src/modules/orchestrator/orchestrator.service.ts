import { Injectable, Logger } from "@nestjs/common";

import { QuoteAggregatorService } from "./quote-aggregator.service";
import { SessionManagerService } from "./session-manager.service";
import {
  CreateSessionRequest,
  FlowType,
  NegotiationResult,
  Quote,
  VendorContactInfo,
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

    // Contact vendors in parallel (fire and forget)
    this.contactVendors(session.id, vendors, request.requestData).catch((error) => {
      this.logger.error({
        event: "VENDOR_CONTACT_FAILED",
        sessionId: session.id,
        error: error.message,
      });
    });

    // Update session status to negotiating
    await this.sessionManager.updateSessionStatus(session.id, "negotiating");

    // Return initial result
    return {
      sessionId: session.id,
      status: "negotiating",
      quotesReceived: 0,
      allQuotes: [],
      timeElapsed: 0,
      timedOut: false,
    };
  }

  /**
   * Contact vendors in parallel
   * 
   * Sends quote requests to all discovered vendors.
   * Runs asynchronously and does not block the negotiation start.
   * 
   * @param sessionId - Session identifier
   * @param vendors - Array of vendor contact information
   * @param requestDetails - Details of the request
   */
  private async contactVendors(
    sessionId: string,
    vendors: VendorContactInfo[],
    requestDetails: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log({
      event: "CONTACTING_VENDORS",
      sessionId,
      vendorCount: vendors.length,
    });

    // Send requests in parallel
    const promises = vendors.map((vendor) =>
      this.sendQuoteRequest(sessionId, vendor, requestDetails).catch((error) => {
        this.logger.error({
          event: "SINGLE_VENDOR_CONTACT_FAILED",
          sessionId,
          vendorId: vendor.id,
          error: error.message,
        });
        // Don't let one failure stop others
      }),
    );

    await Promise.allSettled(promises);

    this.logger.log({
      event: "VENDORS_CONTACTED",
      sessionId,
      vendorCount: vendors.length,
    });
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

    // Get quote details for vendor notification
    const quotes = await this.quoteAggregator.getSessionQuotes(sessionId);
    const selectedQuote = quotes.find((q) => q.id === quoteId);

    if (selectedQuote && selectedQuote.vendorPhone) {
      // Notify selected vendor
      await this.notifyVendorOfAcceptance(selectedQuote);
    }

    // Notify rejected vendors
    const rejectedQuotes = quotes.filter((q) => q.id !== quoteId && q.status === "rejected");
    for (const quote of rejectedQuotes) {
      if (quote.vendorPhone) {
        await this.notifyVendorOfRejection(quote);
      }
    }

    // TODO: Create trip/booking/order based on flow type
  }

  /**
   * Notify vendor of quote acceptance
   */
  private async notifyVendorOfAcceptance(quote: Quote): Promise<void> {
    this.logger.log({
      event: "VENDOR_ACCEPTANCE_NOTIFICATION",
      quoteId: quote.id,
      vendorId: quote.vendorId,
    });

    // TODO: Send WhatsApp message to vendor
    // "✅ Great news! Your quote was accepted. Customer details will be shared shortly."
  }

  /**
   * Notify vendor of quote rejection
   */
  private async notifyVendorOfRejection(quote: Quote): Promise<void> {
    this.logger.log({
      event: "VENDOR_REJECTION_NOTIFICATION",
      quoteId: quote.id,
      vendorId: quote.vendorId,
    });

    // TODO: Send WhatsApp message to vendor
    // "Thank you for your quote. Customer chose another option this time."
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

    // Notify vendors that negotiation was cancelled
    const quotes = await this.quoteAggregator.getSessionQuotes(sessionId);
    for (const quote of quotes) {
      if (quote.vendorPhone && quote.status === "pending") {
        await this.notifyVendorOfCancellation(quote);
      }
    }
  }

  /**
   * Notify vendor of negotiation cancellation
   */
  private async notifyVendorOfCancellation(quote: Quote): Promise<void> {
    this.logger.log({
      event: "VENDOR_CANCELLATION_NOTIFICATION",
      quoteId: quote.id,
      vendorId: quote.vendorId,
    });

    // TODO: Send WhatsApp message to vendor
    // "The customer has cancelled this request. Thank you for your time."
  }

  /**
   * Find vendors for a flow type
   * 
   * Discovers vendors based on flow type and request parameters.
   * Uses Supabase functions and queries to find relevant vendors.
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

    const supabase = this.sessionManager["supabase"]; // Access private supabase client

    switch (flowType) {
      case "nearby_drivers": {
        const tripId = requestData.tripId as string;
        if (!tripId) {
          this.logger.warn({ event: "FIND_VENDORS_NO_TRIP_ID" });
          return [];
        }

        const { data, error } = await supabase.rpc("match_drivers_for_trip_v2", {
          _trip_id: tripId,
          _limit: 10,
          _radius_m: 5000,
        });

        if (error) {
          this.logger.error({
            event: "FIND_DRIVERS_FAILED",
            error: error.message,
          });
          return [];
        }

        return (data || []).map((driver: any) => ({
          id: driver.creator_user_id,
          type: "driver",
          name: driver.ref_code,
          phone: driver.whatsapp_e164,
          metadata: {
            distance_km: driver.distance_km,
            vehicle_type: driver.vehicle_type,
          },
        }));
      }

      case "pharmacy":
      case "quincaillerie":
      case "shops": {
        const location = requestData.location as { lat: number; lng: number };
        const searchQuery = requestData.query as string;
        
        if (!location) {
          this.logger.warn({ event: "FIND_VENDORS_NO_LOCATION" });
          return [];
        }

        // Query marketplace_entries or businesses table
        // This is a placeholder - actual implementation depends on schema
        const vendorType = flowType === "pharmacy" ? "pharmacy" 
          : flowType === "quincaillerie" ? "hardware" 
          : "shop";

        const { data, error } = await supabase
          .from("businesses")
          .select("id, name, phone_number, location, business_type")
          .eq("business_type", vendorType)
          .limit(10);

        if (error) {
          this.logger.error({
            event: "FIND_VENDORS_FAILED",
            error: error.message,
            flowType,
          });
          return [];
        }

        return (data || []).map((vendor: any) => ({
          id: vendor.id,
          type: vendorType,
          name: vendor.name,
          phone: vendor.phone_number,
          metadata: {
            location: vendor.location,
          },
        }));
      }

      case "property_rental": {
        const location = requestData.location as { lat: number; lng: number };
        const bedrooms = requestData.bedrooms as number;
        const budget = requestData.budget as number;

        const { data, error } = await supabase
          .from("property_listings")
          .select("id, owner_id, bedrooms, price, location, address")
          .eq("status", "available")
          .gte("bedrooms", bedrooms || 1)
          .lte("price", budget || 1000000)
          .limit(10);

        if (error) {
          this.logger.error({
            event: "FIND_PROPERTIES_FAILED",
            error: error.message,
          });
          return [];
        }

        return (data || []).map((property: any) => ({
          id: property.id,
          type: "property_owner",
          name: `Property ${property.id.substring(0, 8)}`,
          phone: null, // Get from owner profile
          metadata: {
            bedrooms: property.bedrooms,
            price: property.price,
            address: property.address,
          },
        }));
      }

      default:
        this.logger.warn({
          event: "UNSUPPORTED_FLOW_TYPE",
          flowType,
        });
        return [];
    }
  }

  /**
   * Send quote request to vendor
   * 
   * Sends WhatsApp message to vendor requesting a quote.
   * Message format varies based on vendor type and flow.
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

    if (!vendor.phone) {
      this.logger.warn({
        event: "VENDOR_NO_PHONE",
        sessionId,
        vendorId: vendor.id,
      });
      return;
    }

    // Format message based on vendor type
    const message = this.formatQuoteRequestMessage(vendor.type, requestDetails);

    // Send via WhatsApp API
    // This would integrate with the WhatsApp webhook/sender service
    const whatsappApiUrl = process.env.WHATSAPP_API_URL || "http://localhost:8080/send-message";
    
    try {
      const response = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          to: vendor.phone,
          message: message,
          metadata: {
            sessionId,
            vendorId: vendor.id,
            vendorType: vendor.type,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API returned ${response.status}`);
      }

      this.logger.log({
        event: "QUOTE_REQUEST_DELIVERED",
        sessionId,
        vendorId: vendor.id,
      });
    } catch (error) {
      this.logger.error({
        event: "QUOTE_REQUEST_SEND_FAILED",
        sessionId,
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Format quote request message based on vendor type
   * 
   * @param vendorType - Type of vendor
   * @param requestDetails - Request details
   * @returns Formatted message string
   */
  private formatQuoteRequestMessage(
    vendorType: string,
    requestDetails: Record<string, unknown>,
  ): string {
    switch (vendorType) {
      case "driver":
        return `🚖 New trip request! A customer needs a ride. Reply with your best price and ETA if you're available.`;
      
      case "pharmacy":
        const medication = requestDetails.medication as string;
        return `💊 New medication request: ${medication}. If you have it in stock, reply with your price.`;
      
      case "hardware":
      case "quincaillerie":
        const items = requestDetails.items as string[];
        return `🔨 New hardware request: ${items?.join(", ") || "various items"}. Reply with your quote if available.`;
      
      case "shop":
        const products = requestDetails.products as string[];
        return `🛍️ New product request: ${products?.join(", ") || "products"}. Reply with your price if you have them.`;
      
      case "property_owner":
        const bedrooms = requestDetails.bedrooms as number;
        const budget = requestDetails.budget as number;
        return `🏠 Property inquiry: Customer looking for ${bedrooms}-bedroom place, budget ${budget} RWF. Interested?`;
      
      default:
        return `📋 New request from a customer. Please reply with your quote if you can help.`;
    }
  }

  /**
   * Handle incoming quote response from vendor
   * 
   * Called when vendor responds to quote request.
   * Parses the response, creates a quote, and checks if ready to present.
   * 
   * @param sessionId - Session identifier
   * @param vendorId - Vendor identifier
   * @param quoteData - Quote details from vendor response
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

    // Get session to ensure it's still active
    const session = await this.sessionManager.getSession(sessionId);
    if (!session || session.status === "timeout" || session.status === "completed") {
      this.logger.warn({
        event: "VENDOR_RESPONSE_SESSION_ENDED",
        sessionId,
        vendorId,
        status: session?.status,
      });
      return;
    }

    // Parse quote data
    const priceAmount = this.extractPrice(quoteData);
    const estimatedTime = this.extractEstimatedTime(quoteData);

    // Create quote
    await this.quoteAggregator.addQuote({
      sessionId,
      vendorId,
      vendorType: quoteData.vendorType as string || "unknown",
      vendorName: quoteData.vendorName as string,
      vendorPhone: quoteData.vendorPhone as string,
      offerData: quoteData,
      priceAmount,
      priceCurrency: "RWF",
      estimatedTimeMinutes: estimatedTime,
      notes: quoteData.notes as string,
    });

    // Check if we have enough quotes (3+)
    const quotes = await this.quoteAggregator.getSessionQuotes(sessionId);
    const receivedQuotes = quotes.filter((q) => q.status === "received");

    this.logger.log({
      event: "QUOTE_COUNT_CHECK",
      sessionId,
      receivedQuotes: receivedQuotes.length,
    });

    // If we have 3+ quotes, present to user
    if (receivedQuotes.length >= 3) {
      await this.sessionManager.updateSessionStatus(sessionId, "presenting");
      
      // TODO: Send quote presentation to user via WhatsApp
      this.logger.log({
        event: "READY_TO_PRESENT",
        sessionId,
        quotesCount: receivedQuotes.length,
      });
    }
  }

  /**
   * Extract price from vendor response
   */
  private extractPrice(quoteData: Record<string, unknown>): number | undefined {
    if (typeof quoteData.price === "number") return quoteData.price;
    if (typeof quoteData.amount === "number") return quoteData.amount;
    if (typeof quoteData.priceAmount === "number") return quoteData.priceAmount;
    
    // Try to parse from text
    const text = String(quoteData.text || quoteData.message || "");
    const matches = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (matches) {
      return parseFloat(matches[1].replace(/,/g, ""));
    }
    
    return undefined;
  }

  /**
   * Extract estimated time from vendor response
   */
  private extractEstimatedTime(quoteData: Record<string, unknown>): number | undefined {
    if (typeof quoteData.eta === "number") return quoteData.eta;
    if (typeof quoteData.estimatedTime === "number") return quoteData.estimatedTime;
    if (typeof quoteData.minutes === "number") return quoteData.minutes;
    
    // Try to parse from text
    const text = String(quoteData.text || quoteData.message || "").toLowerCase();
    const matches = text.match(/(\d+)\s*min/);
    if (matches) {
      return parseInt(matches[1], 10);
    }
    
    return undefined;
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

      // Get quote count
      const quotes = await this.quoteAggregator.getSessionQuotes(session.id);
      const receivedQuotes = quotes.filter((q) => q.status === "received");

      // Send appropriate message to user
      if (receivedQuotes.length === 0) {
        await this.sendExpiringWarning(session, receivedQuotes.length);
      } else if (receivedQuotes.length < 3) {
        await this.offerPartialResults(session, receivedQuotes.length);
      }
      // If 3+ quotes, session should already be in presenting state
    }
  }

  /**
   * Send warning about approaching deadline with no quotes
   */
  private async sendExpiringWarning(session: any, quotesCount: number): Promise<void> {
    this.logger.log({
      event: "EXPIRING_WARNING_SENT",
      sessionId: session.id,
      quotesCount,
    });

    // TODO: Send WhatsApp message to user
    // "⏱️ Still searching... No responses yet. Need more time?"
  }

  /**
   * Offer to present partial results
   */
  private async offerPartialResults(session: any, quotesCount: number): Promise<void> {
    this.logger.log({
      event: "PARTIAL_RESULTS_OFFERED",
      sessionId: session.id,
      quotesCount,
    });

    // TODO: Send WhatsApp message to user
    // "⏱️ I have {quotesCount} quote(s) so far. Want to see them now or wait for more?"
  }

  /**
   * Timeout expired sessions
   * 
   * Background task that marks sessions as timed out.
   * 
   * Should be called by a scheduled job every minute.
   */
  async timeoutExpiredSessions(): Promise<void> {
    const supabase = this.sessionManager["supabase"];
    
    // Find sessions past deadline with active status
    const { data: sessions, error } = await supabase
      .from("agent_sessions")
      .select("id, user_id, deadline_at")
      .in("status", ["searching", "negotiating"])
      .lt("deadline_at", new Date().toISOString());

    if (error) {
      this.logger.error({
        event: "TIMEOUT_CHECK_FAILED",
        error: error.message,
      });
      return;
    }

    for (const session of sessions || []) {
      // Count received quotes
      const quotes = await this.quoteAggregator.getSessionQuotes(session.id);
      const receivedQuotes = quotes.filter((q) => q.status === "received");
      const hasQuotes = receivedQuotes.length > 0;

      // Update session status
      await this.sessionManager.updateSessionStatus(session.id, "timeout", {
        reason: hasQuotes ? "deadline_expired_with_quotes" : "deadline_expired_no_quotes",
        quotes_received: receivedQuotes.length,
      });

      this.logger.warn({
        event: "SESSION_TIMED_OUT",
        sessionId: session.id,
        quotesReceived: receivedQuotes.length,
      });

      // Present partial results if we have quotes
      if (hasQuotes) {
        await this.presentQuotesToUser(session.id, session.user_id);
      } else {
        await this.notifyNoResults(session.id, session.user_id);
      }
    }
  }

  /**
   * Present quotes to user via WhatsApp
   */
  private async presentQuotesToUser(sessionId: string, userId: string): Promise<void> {
    this.logger.log({
      event: "PRESENTING_QUOTES",
      sessionId,
    });

    const bestQuotes = await this.quoteAggregator.getBestQuotes(sessionId, 3);

    // TODO: Format and send quote presentation via WhatsApp
    // Include: vendor name, price, ETA, and selection buttons
  }

  /**
   * Notify user of no results
   */
  private async notifyNoResults(sessionId: string, userId: string): Promise<void> {
    this.logger.log({
      event: "NO_RESULTS_NOTIFICATION",
      sessionId,
    });

    // TODO: Send WhatsApp message
    // "😔 No vendors responded within the time window. Try again or expand search?"
  }
}
