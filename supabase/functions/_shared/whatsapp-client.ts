/**
 * WhatsApp API Client with Circuit Breaker Protection
 * 
 * Wraps all WhatsApp Graph API calls with circuit breaker pattern
 * to prevent cascading failures when WhatsApp API is down.
 */

import { CircuitBreaker, CircuitState } from "./circuit-breaker.ts";
import { logStructuredEvent } from "./observability.ts";

// Circuit breaker specifically for WhatsApp Graph API
const whatsappCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes in half-open
  timeout: 30000,           // Try again after 30 seconds
  windowSize: 60000,        // Count failures over 60 seconds
});

export interface WhatsAppMessageRequest {
  to: string;
  type: "text" | "image" | "interactive" | "template";
  text?: { body: string };
  image?: { link: string; caption?: string };
  interactive?: any;
  template?: any;
}

export interface WhatsAppAPIConfig {
  phoneId: string;
  accessToken: string;
  apiVersion?: string;
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public nextRetryAt: number,
    public metrics: any,
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Send a WhatsApp message with circuit breaker protection
 */
export async function sendWhatsAppMessage(
  config: WhatsAppAPIConfig,
  message: WhatsAppMessageRequest,
  correlationId?: string,
): Promise<Response> {
  // Check if circuit breaker allows the request
  if (!whatsappCircuitBreaker.canExecute()) {
    const metrics = whatsappCircuitBreaker.getMetrics();
    const nextRetryMs = metrics.lastStateChange + 30000; // timeout duration
    
    await logStructuredEvent("WHATSAPP_CIRCUIT_OPEN", {
      correlationId,
      to: maskPhone(message.to),
      state: metrics.state,
      failureCount: metrics.failureCount,
      nextRetryAt: new Date(nextRetryMs).toISOString(),
    }, "warn");
    
    throw new CircuitBreakerOpenError(
      "WhatsApp API circuit breaker is OPEN - service temporarily unavailable",
      nextRetryMs,
      metrics,
    );
  }

  const apiVersion = config.apiVersion ?? "v18.0";
  const url = `https://graph.facebook.com/${apiVersion}/${config.phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...message,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      // Record success
      whatsappCircuitBreaker.recordSuccess();
      
      await logStructuredEvent("WHATSAPP_MESSAGE_SENT", {
        correlationId,
        to: maskPhone(message.to),
        type: message.type,
        status: response.status,
      }, "info");
      
      return response;
    } else {
      // HTTP error - record failure
      const errorBody = await response.text();
      
      whatsappCircuitBreaker.recordFailure(
        `HTTP ${response.status}: ${errorBody}`,
      );
      
      await logStructuredEvent("WHATSAPP_API_ERROR", {
        correlationId,
        to: maskPhone(message.to),
        status: response.status,
        error: errorBody,
        circuitState: whatsappCircuitBreaker.getState(),
      }, "error");
      
      throw new Error(`WhatsApp API error: ${response.status} ${errorBody}`);
    }
  } catch (error) {
    // Network error or timeout - record failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    whatsappCircuitBreaker.recordFailure(errorMessage);
    
    await logStructuredEvent("WHATSAPP_API_FAILURE", {
      correlationId,
      to: maskPhone(message.to),
      error: errorMessage,
      circuitState: whatsappCircuitBreaker.getState(),
    }, "error");
    
    throw error;
  }
}

/**
 * Get WhatsApp API circuit breaker status
 */
export function getWhatsAppCircuitStatus() {
  return {
    ...whatsappCircuitBreaker.getMetrics(),
    canExecute: whatsappCircuitBreaker.canExecute(),
  };
}

/**
 * Reset WhatsApp API circuit breaker (manual intervention)
 */
export function resetWhatsAppCircuit() {
  whatsappCircuitBreaker.reset();
  logStructuredEvent("WHATSAPP_CIRCUIT_RESET", {
    timestamp: new Date().toISOString(),
  }, "info");
}

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}
