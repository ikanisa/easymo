/**
 * Service Discovery and Registry for EasyMO Microservices
 * 
 * Provides service endpoint management, health checking, and load balancing
 * for reliable inter-service communication.
 * 
 * @module service-discovery
 */

import { CircuitBreaker, CircuitBreakerOptions } from "./circuit-breaker";
import { logger } from "./logger";

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
export class ServiceRegistry {
  private services: Map<string, ServiceEndpoint[]> = new Map();
  private healthStatus: Map<string, ServiceHealth> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker<any>> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs: number;

  constructor(options?: { healthCheckIntervalMs?: number }) {
    this.healthCheckIntervalMs = options?.healthCheckIntervalMs ?? 30000; // 30 seconds default
  }

  /**
   * Register a service endpoint
   * 
   * @param endpoint - Service endpoint configuration
   */
  register(endpoint: ServiceEndpoint): void {
    const endpoints = this.services.get(endpoint.name) || [];
    endpoints.push(endpoint);
    this.services.set(endpoint.name, endpoints);

    // Initialize health status
    const healthKey = this.getHealthKey(endpoint.name, endpoint.url);
    this.healthStatus.set(healthKey, {
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });

    // Create circuit breaker for this endpoint
    const breakerOptions: CircuitBreakerOptions = {
      timeout: endpoint.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 60000, // 1 minute
      volumeThreshold: 5,
      name: `${endpoint.name}:${endpoint.url}`,
    };

    const breaker = new CircuitBreaker(
      async (url: string, init?: RequestInit) => {
        const response = await fetch(url, init);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      },
      breakerOptions
    );

    // Set fallback for circuit breaker
    breaker.setFallback(() => {
      logger.warn({
        service: endpoint.name,
        url: endpoint.url,
      }, "Circuit breaker fallback triggered");
      throw new Error(`Service ${endpoint.name} is currently unavailable`);
    });

    this.circuitBreakers.set(healthKey, breaker);

    logger.info({
      service: endpoint.name,
      url: endpoint.url,
      timeout: endpoint.timeout,
    }, "Service registered");
  }

  /**
   * Discover a healthy service endpoint
   * 
   * @param serviceName - Name of the service to discover
   * @returns Healthy service endpoint
   * @throws Error if no healthy endpoint is found
   */
  async discoverService(serviceName: string): Promise<ServiceEndpoint> {
    const endpoints = this.services.get(serviceName);
    if (!endpoints || endpoints.length === 0) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    // Find healthy endpoint with lowest consecutive failures
    let bestEndpoint: ServiceEndpoint | null = null;
    let lowestFailures = Infinity;

    for (const endpoint of endpoints) {
      const healthKey = this.getHealthKey(endpoint.name, endpoint.url);
      const health = this.healthStatus.get(healthKey);

      if (health && health.healthy && health.consecutiveFailures < lowestFailures) {
        bestEndpoint = endpoint;
        lowestFailures = health.consecutiveFailures;
      }
    }

    if (bestEndpoint) {
      return bestEndpoint;
    }

    // No healthy endpoints, try to find one that might have recovered
    for (const endpoint of endpoints) {
      const isHealthy = await this.checkHealth(endpoint);
      if (isHealthy) {
        return endpoint;
      }
    }

    throw new Error(`No healthy instances of ${serviceName} available`);
  }

  /**
   * Check health of a specific endpoint
   * 
   * @param endpoint - Service endpoint to check
   * @returns True if endpoint is healthy
   */
  async checkHealth(endpoint: ServiceEndpoint): Promise<boolean> {
    const healthKey = this.getHealthKey(endpoint.name, endpoint.url);
    const currentHealth = this.healthStatus.get(healthKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second health check timeout

      const response = await fetch(endpoint.healthCheckUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;

      // Update health status
      this.healthStatus.set(healthKey, {
        healthy: isHealthy,
        lastCheck: new Date(),
        consecutiveFailures: isHealthy ? 0 : (currentHealth?.consecutiveFailures || 0) + 1,
      });

      if (isHealthy && currentHealth && !currentHealth.healthy) {
        logger.info({
          service: endpoint.name,
          url: endpoint.url,
        }, "Service recovered");
      } else if (!isHealthy) {
        logger.warn({
          service: endpoint.name,
          url: endpoint.url,
          consecutiveFailures: (currentHealth?.consecutiveFailures || 0) + 1,
        }, "Service health check failed");
      }

      return isHealthy;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.healthStatus.set(healthKey, {
        healthy: false,
        lastCheck: new Date(),
        consecutiveFailures: (currentHealth?.consecutiveFailures || 0) + 1,
        lastError: errorMessage,
      });

      logger.error({
        service: endpoint.name,
        url: endpoint.url,
        error: errorMessage,
      }, "Service health check error");

      return false;
    }
  }

  /**
   * Make a request to a service with circuit breaker protection
   * 
   * @param serviceName - Name of the service
   * @param path - API path
   * @param init - Fetch options
   * @returns Response from the service
   */
  async request(
    serviceName: string,
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    const endpoint = await this.discoverService(serviceName);
    const url = `${endpoint.url}${path}`;
    const healthKey = this.getHealthKey(endpoint.name, endpoint.url);
    const breaker = this.circuitBreakers.get(healthKey);

    if (!breaker) {
      throw new Error(`No circuit breaker configured for ${serviceName}`);
    }

    try {
      const response = await breaker.fire(url, init);
      return response;
    } catch (error) {
      logger.error({
        service: serviceName,
        url,
        error: error instanceof Error ? error.message : String(error),
      }, "Service request failed");
      throw error;
    }
  }

  /**
   * Get all registered services
   * 
   * @returns Map of service names to endpoints
   */
  getAllServices(): Map<string, ServiceEndpoint[]> {
    return new Map(this.services);
  }

  /**
   * Get health status of all endpoints
   * 
   * @returns Health status report
   */
  getHealthReport(): Record<string, ServiceHealth> {
    const report: Record<string, ServiceHealth> = {};
    this.healthStatus.forEach((health, key) => {
      report[key] = { ...health };
    });
    return report;
  }

  /**
   * Get circuit breaker statistics for all services
   * 
   * @returns Circuit breaker stats
   */
  getCircuitBreakerStats(): Record<string, ReturnType<CircuitBreaker<any>["getStats"]>> {
    const stats: Record<string, ReturnType<CircuitBreaker<any>["getStats"]>> = {};
    this.circuitBreakers.forEach((breaker, key) => {
      stats[key] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      logger.warn("Health checks already running");
      return;
    }

    logger.info({ intervalMs: this.healthCheckIntervalMs }, "Starting periodic health checks");

    this.healthCheckInterval = setInterval(async () => {
      const endpoints: ServiceEndpoint[] = [];
      this.services.forEach((serviceEndpoints) => {
        endpoints.push(...serviceEndpoints);
      });

      await Promise.allSettled(
        endpoints.map((endpoint) => this.checkHealth(endpoint))
      );
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info("Stopped periodic health checks");
    }
  }

  /**
   * Manually mark an endpoint as healthy or unhealthy
   * 
   * @param serviceName - Service name
   * @param url - Service URL
   * @param healthy - Health status
   */
  setHealthStatus(serviceName: string, url: string, healthy: boolean): void {
    const healthKey = this.getHealthKey(serviceName, url);
    const current = this.healthStatus.get(healthKey);

    this.healthStatus.set(healthKey, {
      healthy,
      lastCheck: new Date(),
      consecutiveFailures: healthy ? 0 : (current?.consecutiveFailures || 0) + 1,
    });

    logger.info({
      service: serviceName,
      url,
      healthy,
    }, "Health status manually set");
  }

  private getHealthKey(serviceName: string, url: string): string {
    return `${serviceName}:${url}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthChecks();
    this.services.clear();
    this.healthStatus.clear();
    this.circuitBreakers.clear();
  }
}

/**
 * Create a global service registry instance
 */
let globalRegistry: ServiceRegistry | null = null;

/**
 * Get or create the global service registry
 * 
 * @returns Global service registry instance
 */
export function getServiceRegistry(): ServiceRegistry {
  if (!globalRegistry) {
    globalRegistry = new ServiceRegistry();
  }
  return globalRegistry;
}

/**
 * Initialize service registry with configuration
 * 
 * @param config - Service configuration
 */
export function initializeServiceRegistry(config: {
  services: ServiceEndpoint[];
  healthCheckIntervalMs?: number;
}): ServiceRegistry {
  const registry = new ServiceRegistry({
    healthCheckIntervalMs: config.healthCheckIntervalMs,
  });

  config.services.forEach((endpoint) => registry.register(endpoint));
  registry.startHealthChecks();

  globalRegistry = registry;
  return registry;
}
