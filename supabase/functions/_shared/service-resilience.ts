/**
 * Service Resilience Module
 * 
 * Provides circuit breaker and rate limiting patterns for microservices routing.
 * Implements resilience patterns as recommended in WA_WEBHOOK_CORE architecture.
 * 
 * @see docs/GROUND_RULES.md for usage guidelines
 */

import { logStructuredEvent, recordMetric } from "./observability.ts";
import { maskPhone,normalizePhone } from "./phone-utils.ts";

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_THRESHOLD = Math.max(
  Number(Deno.env.get("WA_CIRCUIT_BREAKER_THRESHOLD") ?? "5") || 5,
  2,
);
const CIRCUIT_BREAKER_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("WA_CIRCUIT_BREAKER_TIMEOUT_MS") ?? "30000") || 30000,
  5000,
);
const CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("WA_CIRCUIT_BREAKER_HALF_OPEN_MS") ?? "15000") || 15000,
  1000,
);

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = Math.max(
  Number(Deno.env.get("WA_RATE_LIMIT_WINDOW_MS") ?? "60000") || 60000,
  1000,
);
const RATE_LIMIT_MAX_REQUESTS = Math.max(
  Number(Deno.env.get("WA_RATE_LIMIT_MAX_REQUESTS") ?? "30") || 30,
  1,
);

// Retry Configuration
const MAX_RETRY_ATTEMPTS = Math.max(
  Number(Deno.env.get("WA_MAX_RETRY_ATTEMPTS") ?? "2") || 2,
  0,
);
const BASE_RETRY_DELAY_MS = Math.max(
  Number(Deno.env.get("WA_BASE_RETRY_DELAY_MS") ?? "200") || 200,
  50,
);

/**
 * HTTP status codes that should trigger retry
 * Configurable via WA_RETRIABLE_STATUS_CODES env var (comma-separated)
 */
const RETRIABLE_STATUS_CODES = ((): number[] => {
  const envValue = Deno.env.get("WA_RETRIABLE_STATUS_CODES");
  if (envValue) {
    return envValue.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  }
  return [408, 429, 503, 504];
})();

type CircuitState = "closed" | "open" | "half-open";

interface ServiceCircuit {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  openUntil: number;
  halfOpenAttempts: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory state (reset per edge function instance)
const serviceCircuits = new Map<string, ServiceCircuit>();
const rateLimitState = new Map<string, RateLimitEntry>();

/**
 * Circuit Breaker: Check if circuit is open for a service
 * 
 * Circuit states:
 * - closed: Normal operation, requests pass through
 * - open: Circuit tripped, requests are rejected immediately
 * - half-open: Testing if service has recovered, limited requests allowed
 */
export function isServiceCircuitOpen(service: string): boolean {
  const circuit = serviceCircuits.get(service);
  if (!circuit) return false;

  const now = Date.now();

  if (circuit.state === "open") {
    // Check if enough time has passed to transition to half-open
    if (now >= circuit.openUntil) {
      circuit.state = "half-open";
      circuit.halfOpenAttempts = 0;
      logStructuredEvent("CIRCUIT_HALF_OPEN", {
        service,
        previousFailures: circuit.failures,
      }, "info");
      return false; // Allow one request through
    }
    return true; // Still open, reject request
  }

  if (circuit.state === "half-open") {
    // Allow limited requests through in half-open state
    if (circuit.halfOpenAttempts >= 1) {
      return true; // Already testing, reject additional requests
    }
    circuit.halfOpenAttempts++;
    return false;
  }

  return false; // Closed state, allow requests
}

/**
 * Record a successful request to a service
 * Closes the circuit if in half-open state
 */
export function recordServiceSuccess(service: string): void {
  const circuit = serviceCircuits.get(service);
  if (!circuit) return;

  if (circuit.state === "half-open") {
    // Service has recovered, close the circuit
    serviceCircuits.delete(service);
    logStructuredEvent("CIRCUIT_CLOSED", {
      service,
      reason: "success_in_half_open",
    }, "info");
    recordMetric("circuit_breaker.closed", 1, { service });
  } else if (circuit.state === "closed") {
    // Reset failure count on success
    circuit.failures = 0;
  }
}

/**
 * Record a failed request to a service
 * Opens the circuit if failures exceed threshold
 */
export function recordServiceFailure(
  service: string,
  errorCode?: number | string,
  correlationId?: string,
): void {
  const now = Date.now();
  let circuit = serviceCircuits.get(service);

  if (!circuit) {
    circuit = {
      state: "closed",
      failures: 0,
      lastFailure: 0,
      openUntil: 0,
      halfOpenAttempts: 0,
    };
    serviceCircuits.set(service, circuit);
  }

  circuit.failures++;
  circuit.lastFailure = now;

  logStructuredEvent("SERVICE_FAILURE_RECORDED", {
    service,
    failures: circuit.failures,
    threshold: CIRCUIT_BREAKER_THRESHOLD,
    errorCode,
    correlationId,
  }, "warn");

  if (circuit.state === "half-open") {
    // Failed during recovery test, reopen circuit
    circuit.state = "open";
    circuit.openUntil = now + CIRCUIT_BREAKER_TIMEOUT_MS;
    logStructuredEvent("CIRCUIT_REOPENED", {
      service,
      failures: circuit.failures,
      openUntil: new Date(circuit.openUntil).toISOString(),
      correlationId,
    }, "warn");
    recordMetric("circuit_breaker.reopened", 1, { service });
    return;
  }

  if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuit.state = "open";
    circuit.openUntil = now + CIRCUIT_BREAKER_TIMEOUT_MS;
    logStructuredEvent("CIRCUIT_OPENED", {
      service,
      failures: circuit.failures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      openUntil: new Date(circuit.openUntil).toISOString(),
      correlationId,
    }, "warn");
    recordMetric("circuit_breaker.opened", 1, { service });
  }
}

/**
 * Get current circuit state for a service (for monitoring/health checks)
 */
export function getCircuitState(service: string): {
  state: CircuitState;
  failures: number;
  openUntil?: string;
} {
  const circuit = serviceCircuits.get(service);
  if (!circuit) {
    return { state: "closed", failures: 0 };
  }
  return {
    state: circuit.state,
    failures: circuit.failures,
    openUntil: circuit.openUntil > 0 ? new Date(circuit.openUntil).toISOString() : undefined,
  };
}

/**
 * Rate Limiter: Check if a phone number has exceeded rate limit
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(phoneNumber: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = normalizePhone(phoneNumber); // Use shared normalization
  
  let entry = rateLimitState.get(key);

  // Create new window if doesn't exist or window has expired
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    rateLimitState.set(key, entry);
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);
  const resetAt = entry.windowStart + RATE_LIMIT_WINDOW_MS;

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    logStructuredEvent("RATE_LIMIT_EXCEEDED", {
      phone: maskPhone(phoneNumber),
      count: entry.count,
      limit: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    }, "warn");
    recordMetric("rate_limit.exceeded", 1, { source: "wa-webhook-core" });
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: remaining - 1, resetAt };
}

// maskPhone is now imported from phone-utils.ts

/**
 * Retry with exponential backoff
 * Implements retry for transient failures (configurable via WA_RETRIABLE_STATUS_CODES)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number },
  correlationId?: string,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 4000;
  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Don't retry on success or non-retriable errors
      if (response.ok || !RETRIABLE_STATUS_CODES.includes(response.status)) {
        return response;
      }

      lastResponse = response;

      // Log and prepare for retry
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        logStructuredEvent("RETRY_SCHEDULED", {
          url,
          attempt: attempt + 1,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          status: response.status,
          delayMs: delay,
          correlationId,
        }, "info");
        await sleep(delay);
      }
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));

      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      const isNetworkError = error instanceof TypeError;

      // Only retry on timeout or network errors
      if (!isTimeout && !isNetworkError) {
        throw error;
      }

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        logStructuredEvent("RETRY_SCHEDULED", {
          url,
          attempt: attempt + 1,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          error: lastError.message,
          delayMs: delay,
          correlationId,
        }, "info");
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  logStructuredEvent("RETRY_EXHAUSTED", {
    url,
    attempts: MAX_RETRY_ATTEMPTS + 1,
    lastError: lastError?.message,
    lastStatus: lastResponse?.status,
    correlationId,
  }, "error");

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("fetch failed after retries");
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get all services' circuit states (for health check aggregation)
 */
export function getAllCircuitStates(): Record<string, { state: CircuitState; failures: number }> {
  const states: Record<string, { state: CircuitState; failures: number }> = {};
  for (const [service, circuit] of serviceCircuits.entries()) {
    states[service] = { state: circuit.state, failures: circuit.failures };
  }
  return states;
}

/**
 * Clean up expired rate limit entries (memory management)
 * Call periodically to prevent memory leaks in long-running instances
 */
export function cleanupRateLimitState(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of rateLimitState.entries()) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitState.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}
