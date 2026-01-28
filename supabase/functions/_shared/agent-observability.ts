/**
 * Agent Observability Utilities
 * 
 * Specialized logging and metrics for AI agent operations.
 * Extends the base observability utilities with agent-specific events.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { logError,logStructuredEvent } from "./observability.ts";

/**
 * Agent event types for structured logging
 */
export type AgentEventType =
  | "AGENT_SESSION_CREATED"
  | "AGENT_SESSION_STATUS_CHANGED"
  | "AGENT_SESSION_COMPLETED"
  | "AGENT_SESSION_TIMEOUT"
  | "AGENT_SESSION_CANCELLED"
  | "AGENT_QUOTE_SENT"
  | "AGENT_QUOTE_RECEIVED"
  | "AGENT_QUOTE_ACCEPTED"
  | "AGENT_QUOTE_REJECTED"
  | "AGENT_QUOTE_EXPIRED"
  | "AGENT_VENDOR_CONTACTED"
  | "AGENT_VENDOR_RESPONSE_TIMEOUT"
  | "AGENT_NEGOTIATION_STARTED"
  | "AGENT_NEGOTIATION_COMPLETED"
  | "AGENT_DEADLINE_WARNING"
  | "AGENT_PARTIAL_RESULTS_PRESENTED"
  | "AGENT_PATTERN_DETECTED"
  | "AGENT_PROACTIVE_NOTIFICATION"
  | "AGENT_REQUEST_ROUTED"
  | "AGENT_OPTION_SELECTED"
  | "AGENT_ERROR";

/**
 * Flow types for agent sessions
 */
export type AgentFlowType =
  | "nearby_drivers"
  | "nearby_pharmacies"
  | "nearby_quincailleries"
  | "nearby_shops"
  | "scheduled_trip"
  | "recurring_trip";

/**
 * Log an agent event with structured data
 * 
 * @param event - Agent event type
 * @param details - Event details (PII should be masked)
 * 
 * @example
 * logAgentEvent("AGENT_SESSION_CREATED", {
 *   sessionId,
 *   flowType: "nearby_drivers",
 *   userId: maskUserId(userId),
 *   windowMinutes: 5
 * });
 */
export function logAgentEvent(
  event: AgentEventType,
  details: Record<string, unknown> = {},
): void {
  logStructuredEvent(event, {
    category: "agent",
    ...details,
  });
}

/**
 * Log agent negotiation start
 * 
 * @param sessionId - Session identifier
 * @param flowType - Type of flow
 * @param userId - User identifier (will be masked)
 * @param windowMinutes - Negotiation window in minutes
 */
export function logNegotiationStart(
  sessionId: string,
  flowType: AgentFlowType,
  userId: string,
  windowMinutes: number = 5,
): void {
  logAgentEvent("AGENT_NEGOTIATION_STARTED", {
    sessionId,
    flowType,
    userId: maskIdentifier(userId),
    windowMinutes,
    deadlineAt: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString(),
  });
}

/**
 * Log quote collection event
 * 
 * @param sessionId - Session identifier
 * @param vendorId - Vendor identifier
 * @param vendorType - Type of vendor
 * @param priceAmount - Quote price
 * @param estimatedTimeMinutes - Estimated time
 */
export function logQuoteReceived(
  sessionId: string,
  vendorId: string,
  vendorType: string,
  priceAmount?: number,
  estimatedTimeMinutes?: number,
): void {
  logAgentEvent("AGENT_QUOTE_RECEIVED", {
    sessionId,
    vendorId: maskIdentifier(vendorId),
    vendorType,
    priceAmount,
    estimatedTimeMinutes,
  });
}

/**
 * Log negotiation completion
 * 
 * @param sessionId - Session identifier
 * @param quotesReceived - Number of quotes collected
 * @param selectedQuoteId - ID of selected quote
 * @param timeElapsed - Time elapsed in milliseconds
 */
export function logNegotiationCompleted(
  sessionId: string,
  quotesReceived: number,
  selectedQuoteId: string,
  timeElapsed: number,
): void {
  logAgentEvent("AGENT_NEGOTIATION_COMPLETED", {
    sessionId,
    quotesReceived,
    selectedQuoteId,
    timeElapsedMs: timeElapsed,
    timeElapsedSeconds: Math.round(timeElapsed / 1000),
  });
}

/**
 * Log session timeout
 * 
 * @param sessionId - Session identifier
 * @param quotesReceived - Number of quotes collected before timeout
 * @param partialResultsPresented - Whether partial results were shown
 */
export function logSessionTimeout(
  sessionId: string,
  quotesReceived: number,
  partialResultsPresented: boolean,
): void {
  logAgentEvent("AGENT_SESSION_TIMEOUT", {
    sessionId,
    quotesReceived,
    partialResultsPresented,
  });
}

/**
 * Log vendor contact attempt
 * 
 * @param sessionId - Session identifier
 * @param vendorId - Vendor identifier
 * @param vendorType - Type of vendor
 * @param contactMethod - Method used to contact (whatsapp, sms, etc)
 */
export function logVendorContact(
  sessionId: string,
  vendorId: string,
  vendorType: string,
  contactMethod: string = "whatsapp",
): void {
  logAgentEvent("AGENT_VENDOR_CONTACTED", {
    sessionId,
    vendorId: maskIdentifier(vendorId),
    vendorType,
    contactMethod,
  });
}

/**
 * Log agent error with context
 * 
 * @param scope - Error scope (e.g., "negotiation", "quote_collection")
 * @param error - Error object or message
 * @param context - Additional context
 */
export function logAgentError(
  scope: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  logError(`agent_${scope}`, error, {
    category: "agent",
    ...context,
  });
}

/**
 * Mask identifier for PII protection
 * 
 * Shows first 4 and last 4 characters, masks the middle
 * 
 * @param id - Identifier to mask
 * @returns Masked string
 * 
 * @example
 * maskIdentifier("550e8400-e29b-41d4-a716-446655440000")
 * // Returns: "550e***0000"
 */
export function maskIdentifier(id: string): string {
  if (!id || id.length < 8) return "***";
  return id.substring(0, 4) + "***" + id.substring(id.length - 4);
}

/**
 * Mask phone number for PII protection
 * 
 * Shows country code and last 3 digits
 * 
 * @param phone - Phone number to mask (E.164 format)
 * @returns Masked string
 * 
 * @example
 * maskPhone("+250788123456")
 * // Returns: "+250***456"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return "***";
  
  // For E.164 format (+250788123456)
  if (phone.startsWith("+")) {
    const countryCode = phone.substring(0, 4); // +250
    const lastDigits = phone.substring(phone.length - 3); // 456
    return `${countryCode}***${lastDigits}`;
  }
  
  // Fallback for non-E.164
  return phone.substring(0, 3) + "***" + phone.substring(phone.length - 3);
}

/**
 * Record agent session metrics
 * 
 * Helper to record common agent metrics with consistent dimensions.
 * 
 * NOTE: This function is a placeholder for future implementation.
 * The recordMetric function needs to be implemented in observability.ts first.
 * 
 * @param metricName - Metric name
 * @param value - Metric value
 * @param dimensions - Additional dimensions
 */
export function recordAgentMetric(
  metricName: string,
  value: number,
  dimensions: Record<string, string | number> = {},
): void {
  // TODO: Implement once recordMetric is available in observability.ts
  // For now, log as structured event
  logStructuredEvent(`AGENT_METRIC_${metricName.toUpperCase()}`, {
    category: "agent",
    metricName,
    value,
    ...dimensions,
  }, "debug");
}
