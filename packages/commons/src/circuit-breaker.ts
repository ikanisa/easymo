import { logger } from "./logger";

export interface CircuitBreakerOptions {
  /** Timeout for each request in milliseconds */
  timeout: number;
  /** Error threshold percentage (0-100) before opening circuit */
  errorThresholdPercentage: number;
  /** Time in milliseconds to wait before attempting to close circuit */
  resetTimeout: number;
  /** Minimum number of requests before evaluating error rate */
  volumeThreshold?: number;
  /** Name for logging purposes */
  name?: string;
}

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit Breaker pattern implementation for resilient external API calls
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker(whatsappAPI.sendMessage, {
 *   timeout: 3000,
 *   errorThresholdPercentage: 50,
 *   resetTimeout: 30000,
 *   name: "whatsapp-api"
 * });
 * 
 * breaker.setFallback(() => ({ cached: true, message: "Using cached data" }));
 * 
 * const result = await breaker.fire(phoneNumber, message);
 * ```
 */
export class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private nextAttempt = Date.now();
  private fallbackFn?: (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>;

  constructor(
    private readonly fn: T,
    private readonly options: CircuitBreakerOptions
  ) {
    const volumeThreshold = options.volumeThreshold ?? 10;
    if (volumeThreshold < 1) {
      throw new Error("volumeThreshold must be at least 1");
    }
  }

  /**
   * Set a fallback function to call when circuit is open
   */
  setFallback(fn: (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>): void {
    this.fallbackFn = fn;
  }

  /**
   * Execute the function with circuit breaker protection
   */
  async fire(...args: Parameters<T>): Promise<ReturnType<T>> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.warn({
          name: this.options.name,
          state: this.state,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
        }, "Circuit breaker open, request rejected");

        if (this.fallbackFn) {
          return await this.fallbackFn(...args);
        }

        throw new Error(`Circuit breaker is OPEN for ${this.options.name || "function"}`);
      }

      // Transition to half-open to test if service recovered
      this.state = CircuitState.HALF_OPEN;
      logger.info({
        name: this.options.name,
        state: this.state,
      }, "Circuit breaker transitioning to HALF_OPEN");
    }

    try {
      const result = await this.executeWithTimeout(args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (this.fallbackFn) {
        logger.info({
          name: this.options.name,
          error: (error as Error).message,
        }, "Circuit breaker executing fallback");
        return await this.fallbackFn(...args);
      }

      throw error;
    }
  }

  private async executeWithTimeout(args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      this.fn(...args)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.successCount++;
    this.requestCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      logger.info({
        name: this.options.name,
        state: CircuitState.CLOSED,
      }, "Circuit breaker closing after successful request");
      this.reset();
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.requestCount++;

    const volumeThreshold = this.options.volumeThreshold ?? 10;

    if (this.requestCount < volumeThreshold) {
      return; // Not enough data yet
    }

    const errorRate = (this.failureCount / this.requestCount) * 100;

    if (errorRate >= this.options.errorThresholdPercentage) {
      this.trip();
    }

    // Reset counters periodically to avoid stale data
    if (this.requestCount >= volumeThreshold * 2) {
      this.failureCount = Math.floor(this.failureCount / 2);
      this.successCount = Math.floor(this.successCount / 2);
      this.requestCount = Math.floor(this.requestCount / 2);
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;

    logger.error({
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      errorRate: ((this.failureCount / this.requestCount) * 100).toFixed(2) + "%",
      nextAttempt: new Date(this.nextAttempt).toISOString(),
    }, "Circuit breaker opened due to high error rate");
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0
        ? ((this.failureCount / this.requestCount) * 100).toFixed(2) + "%"
        : "0%",
      nextAttempt: this.state === CircuitState.OPEN
        ? new Date(this.nextAttempt).toISOString()
        : null,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  manualReset(): void {
    logger.info({
      name: this.options.name,
      previousState: this.state,
    }, "Circuit breaker manually reset");
    this.reset();
  }
}
