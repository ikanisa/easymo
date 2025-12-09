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
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
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
export declare class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
    private readonly fn;
    private readonly options;
    private state;
    private failureCount;
    private successCount;
    private requestCount;
    private nextAttempt;
    private fallbackFn?;
    constructor(fn: T, options: CircuitBreakerOptions);
    /**
     * Set a fallback function to call when circuit is open
     */
    setFallback(fn: (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>): void;
    /**
     * Execute the function with circuit breaker protection
     */
    fire(...args: Parameters<T>): Promise<ReturnType<T>>;
    private executeWithTimeout;
    private onSuccess;
    private onFailure;
    private trip;
    private reset;
    /**
     * Get current circuit breaker state
     */
    getState(): CircuitState;
    /**
     * Get circuit breaker statistics
     */
    getStats(): {
        state: CircuitState;
        failureCount: number;
        successCount: number;
        requestCount: number;
        errorRate: string;
        nextAttempt: string | null;
    };
    /**
     * Manually reset the circuit breaker
     */
    manualReset(): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map