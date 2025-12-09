/**
 * Service Discovery and Registry for EasyMO Microservices
 *
 * Provides service endpoint management, health checking, and load balancing
 * for reliable inter-service communication.
 *
 * @module service-discovery
 */
import { CircuitBreaker } from "./circuit-breaker";
/**
 * Service endpoint configuration
 */
export interface ServiceEndpoint {
    /** Service name */
    name: string;
    /** Base URL of the service */
    url: string;
    /** Health check endpoint path */
    healthCheckUrl: string;
    /** Request timeout in milliseconds */
    timeout: number;
    /** Retry policy configuration */
    retryPolicy: {
        maxRetries: number;
        backoffMs: number;
    };
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Health status of a service endpoint
 */
export interface ServiceHealth {
    healthy: boolean;
    lastCheck: Date;
    consecutiveFailures: number;
    lastError?: string;
}
/**
 * Service discovery and registry with health checking
 *
 * @example
 * ```typescript
 * const registry = new ServiceRegistry();
 *
 * // Register services
 * registry.register({
 *   name: "waiter-ai",
 *   url: "https://waiter-ai.example.com",
 *   healthCheckUrl: "https://waiter-ai.example.com/health",
 *   timeout: 120000,
 *   retryPolicy: { maxRetries: 3, backoffMs: 1000 }
 * });
 *
 * // Discover and use service
 * const endpoint = await registry.discoverService("waiter-ai");
 * const response = await fetch(endpoint.url + "/api/process", {
 *   method: "POST",
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export declare class ServiceRegistry {
    private services;
    private healthStatus;
    private circuitBreakers;
    private healthCheckInterval?;
    private readonly healthCheckIntervalMs;
    constructor(options?: {
        healthCheckIntervalMs?: number;
    });
    /**
     * Register a service endpoint
     *
     * @param endpoint - Service endpoint configuration
     */
    register(endpoint: ServiceEndpoint): void;
    /**
     * Discover a healthy service endpoint
     *
     * @param serviceName - Name of the service to discover
     * @returns Healthy service endpoint
     * @throws Error if no healthy endpoint is found
     */
    discoverService(serviceName: string): Promise<ServiceEndpoint>;
    /**
     * Check health of a specific endpoint
     *
     * @param endpoint - Service endpoint to check
     * @returns True if endpoint is healthy
     */
    checkHealth(endpoint: ServiceEndpoint): Promise<boolean>;
    /**
     * Make a request to a service with circuit breaker protection
     *
     * @param serviceName - Name of the service
     * @param path - API path
     * @param init - Fetch options
     * @returns Response from the service
     */
    request(serviceName: string, path: string, init?: RequestInit): Promise<Response>;
    /**
     * Get all registered services
     *
     * @returns Map of service names to endpoints
     */
    getAllServices(): Map<string, ServiceEndpoint[]>;
    /**
     * Get health status of all endpoints
     *
     * @returns Health status report
     */
    getHealthReport(): Record<string, ServiceHealth>;
    /**
     * Get circuit breaker statistics for all services
     *
     * @returns Circuit breaker stats
     */
    getCircuitBreakerStats(): Record<string, ReturnType<CircuitBreaker<any>["getStats"]>>;
    /**
     * Start periodic health checks
     */
    startHealthChecks(): void;
    /**
     * Stop periodic health checks
     */
    stopHealthChecks(): void;
    /**
     * Manually mark an endpoint as healthy or unhealthy
     *
     * @param serviceName - Service name
     * @param url - Service URL
     * @param healthy - Health status
     */
    setHealthStatus(serviceName: string, url: string, healthy: boolean): void;
    private getHealthKey;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
/**
 * Get or create the global service registry
 *
 * @returns Global service registry instance
 */
export declare function getServiceRegistry(): ServiceRegistry;
/**
 * Initialize service registry with configuration
 *
 * @param config - Service configuration
 */
export declare function initializeServiceRegistry(config: {
    services: ServiceEndpoint[];
    healthCheckIntervalMs?: number;
}): ServiceRegistry;
//# sourceMappingURL=service-discovery.d.ts.map