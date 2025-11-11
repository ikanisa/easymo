/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by monitoring API calls and temporarily
 * blocking requests when failure thresholds are exceeded.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  /** Name for logging and metrics */
  name?: string;
  
  /** Failure threshold percentage (0-100) */
  failureThreshold: number;
  
  /** Minimum number of requests before opening circuit */
  minimumRequests: number;
  
  /** Time window in ms to track failures */
  windowMs: number;
  
  /** Time in ms to wait before attempting recovery */
  resetTimeoutMs: number;
  
  /** Number of test requests in HALF_OPEN state */
  halfOpenRequests?: number;
  
  /** Timeout for individual requests in ms */
  requestTimeoutMs?: number;
  
  /** Custom function to determine if error should count as failure */
  isFailure?: (error: any) => boolean;
  
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  
  /** Callback when circuit opens */
  onOpen?: () => void;
  
  /** Callback when circuit closes */
  onClose?: () => void;
  
  /** Callback when circuit enters half-open */
  onHalfOpen?: () => void;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly circuitName: string, public readonly nextRetryAt: number) {
    super(`Circuit breaker "${circuitName}" is open. Retry after ${new Date(nextRetryAt).toISOString()}`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
  }
}

interface RequestMetrics {
  total: number;
  failures: number;
  successes: number;
  timeouts: number;
  lastFailureTime?: number;
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private options: Required<CircuitBreakerOptions>;
  private metrics: RequestMetrics = {
    total: 0,
    failures: 0,
    successes: 0,
    timeouts: 0,
  };
  private windowStart: number = Date.now();
  private openedAt?: number;
  private halfOpenAttempts: number = 0;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      name: options.name || "default",
      failureThreshold: options.failureThreshold,
      minimumRequests: options.minimumRequests,
      windowMs: options.windowMs,
      resetTimeoutMs: options.resetTimeoutMs,
      halfOpenRequests: options.halfOpenRequests ?? 3,
      requestTimeoutMs: options.requestTimeoutMs,
      isFailure: options.isFailure ?? (() => true),
      onStateChange: options.onStateChange ?? (() => {}),
      onOpen: options.onOpen ?? (() => {}),
      onClose: options.onClose ?? (() => {}),
      onHalfOpen: options.onHalfOpen ?? (() => {}),
    };
  }

  /**
   * Execute a function protected by the circuit breaker
   */
  async execute<R = T>(fn: () => Promise<R>): Promise<R> {
    // Check if we should attempt the request
    this.checkState();

    if (this.state === CircuitState.OPEN) {
      throw new CircuitBreakerOpenError(
        this.options.name,
        (this.openedAt || 0) + this.options.resetTimeoutMs
      );
    }

    // Reset window if expired
    if (Date.now() - this.windowStart > this.options.windowMs) {
      this.resetWindow();
    }

    const startTime = Date.now();
    this.metrics.total++;

    try {
      // Execute with optional timeout
      const result = this.options.requestTimeoutMs
        ? await this.executeWithTimeout(fn, this.options.requestTimeoutMs)
        : await fn();

      // Record success
      this.onSuccess();
      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<R>(
    fn: () => Promise<R>,
    timeoutMs: number
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RequestTimeoutError(timeoutMs));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Check current state and transition if needed
   */
  private checkState(): void {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.openedAt && now - this.openedAt >= this.options.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
        this.halfOpenAttempts = 0;
      }
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.metrics.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenRequests) {
        this.transitionTo(CircuitState.CLOSED);
        this.resetMetrics();
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: any): void {
    const isFailure = this.options.isFailure(error);

    if (!isFailure) {
      // Don't count this as a circuit breaker failure
      return;
    }

    if (error instanceof RequestTimeoutError) {
      this.metrics.timeouts++;
    }

    this.metrics.failures++;
    this.metrics.lastFailureTime = Date.now();

    // If in HALF_OPEN, immediately open
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = Date.now();
      return;
    }

    // Check if we should open the circuit
    if (this.shouldOpen()) {
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = Date.now();
    }
  }

  /**
   * Determine if circuit should open
   */
  private shouldOpen(): boolean {
    if (this.metrics.total < this.options.minimumRequests) {
      return false;
    }

    const failureRate = (this.metrics.failures / this.metrics.total) * 100;
    return failureRate >= this.options.failureThreshold;
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    // Call callbacks
    this.options.onStateChange(oldState, newState);

    switch (newState) {
      case CircuitState.OPEN:
        this.options.onOpen();
        break;
      case CircuitState.CLOSED:
        this.options.onClose();
        break;
      case CircuitState.HALF_OPEN:
        this.options.onHalfOpen();
        break;
    }
  }

  /**
   * Reset metrics window
   */
  private resetWindow(): void {
    this.windowStart = Date.now();
    this.metrics = {
      total: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
    };
  }

  /**
   * Reset all metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      total: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
    };
    this.windowStart = Date.now();
    this.halfOpenAttempts = 0;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      failureRate:
        this.metrics.total > 0
          ? (this.metrics.failures / this.metrics.total) * 100
          : 0,
      openedAt: this.openedAt,
      nextRetryAt: this.openedAt
        ? this.openedAt + this.options.resetTimeoutMs
        : undefined,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.resetMetrics();
    this.openedAt = undefined;
  }

  /**
   * Get circuit breaker options
   */
  getOptions(): Required<CircuitBreakerOptions> {
    return { ...this.options };
  }
}

/**
 * Create a new circuit breaker
 */
export function createCircuitBreaker<T = any>(
  options: CircuitBreakerOptions
): CircuitBreaker<T> {
  return new CircuitBreaker<T>(options);
}
