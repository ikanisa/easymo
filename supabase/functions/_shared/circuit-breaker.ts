/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by tracking service health and
 * temporarily blocking requests to failing services.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;               // Time in ms before attempting recovery
  windowSize: number;            // Time window in ms for counting failures
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successes: number = 0;
  private lastStateChange: number = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000, // 60 seconds
      windowSize: config.windowSize ?? 60000, // 60 seconds
    };
  }

  /**
   * Check if the circuit breaker allows the request
   */
  canExecute(): boolean {
    this.cleanupOldFailures();

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() - this.lastStateChange >= this.config.timeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failures on success
      this.failures = [];
    }
  }

  /**
   * Record a failed execution
   */
  recordFailure(error: string): void {
    this.failures.push({
      timestamp: Date.now(),
      error,
    });

    this.cleanupOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failures.length >= this.config.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successes,
      lastStateChange: this.lastStateChange,
      timeSinceStateChange: Date.now() - this.lastStateChange,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = [];
    this.successes = 0;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === CircuitState.CLOSED) {
      this.failures = [];
      this.successes = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    console.log(JSON.stringify({
      event: "CIRCUIT_BREAKER_STATE_CHANGE",
      oldState,
      newState,
      timestamp: this.lastStateChange,
    }));
  }

  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private config: Partial<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = config;
  }

  getBreaker(serviceName: string): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(this.config));
    }
    return this.breakers.get(serviceName)!;
  }

  getAllMetrics() {
    const metrics: Record<string, ReturnType<CircuitBreaker["getMetrics"]>> = {};
    for (const [service, breaker] of this.breakers.entries()) {
      metrics[service] = breaker.getMetrics();
    }
    return metrics;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  windowSize: 60000,
});
