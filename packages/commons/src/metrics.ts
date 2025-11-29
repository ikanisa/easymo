import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { childLogger } from './logger';

const log = childLogger({ service: 'metrics' });

export interface MetricsOptions {
  serviceName: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

export class MetricsRegistry {
  private registry: Registry;
  private serviceName: string;

  // HTTP Metrics
  public httpRequestDuration: Histogram;
  public httpRequestTotal: Counter;
  public httpRequestSize: Histogram;
  public httpResponseSize: Histogram;

  // Business Metrics
  public businessOperationTotal: Counter;
  public businessOperationDuration: Histogram;
  public activeConnections: Gauge;
  public queueSize: Gauge;

  constructor(options: MetricsOptions) {
    this.serviceName = options.serviceName;
    this.registry = new Registry();

    // Set default labels
    if (options.defaultLabels) {
      this.registry.setDefaultLabels(options.defaultLabels);
    } else {
      this.registry.setDefaultLabels({
        service: this.serviceName,
        environment: process.env.NODE_ENV || 'development',
      });
    }

    // Collect default Node.js metrics (CPU, memory, etc.)
    if (options.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry, prefix: `${this.serviceName}_` });
    }

    // HTTP Request Duration
    this.httpRequestDuration = new Histogram({
      name: `${this.serviceName}_http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // HTTP Request Total
    this.httpRequestTotal = new Counter({
      name: `${this.serviceName}_http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP Request Size
    this.httpRequestSize = new Histogram({
      name: `${this.serviceName}_http_request_size_bytes`,
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    // HTTP Response Size
    this.httpResponseSize = new Histogram({
      name: `${this.serviceName}_http_response_size_bytes`,
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    // Business Operation Total
    this.businessOperationTotal = new Counter({
      name: `${this.serviceName}_business_operations_total`,
      help: 'Total number of business operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });

    // Business Operation Duration
    this.businessOperationDuration = new Histogram({
      name: `${this.serviceName}_business_operation_duration_seconds`,
      help: 'Duration of business operations in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    // Active Connections
    this.activeConnections = new Gauge({
      name: `${this.serviceName}_active_connections`,
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Queue Size
    this.queueSize = new Gauge({
      name: `${this.serviceName}_queue_size`,
      help: 'Size of processing queues',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    log.info({ serviceName: this.serviceName }, 'Metrics registry initialized');
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.registry.resetMetrics();
  }

  /**
   * Get the underlying registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Record HTTP request metrics
   */
  recordHTTPRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
    this.httpRequestTotal.inc({ method, route, status_code: statusCode });

    if (requestSize !== undefined) {
      this.httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize !== undefined) {
      this.httpResponseSize.observe({ method, route }, responseSize);
    }
  }

  /**
   * Record business operation metrics
   */
  recordBusinessOperation(operation: string, durationSeconds: number, status: 'success' | 'failure'): void {
    this.businessOperationDuration.observe({ operation }, durationSeconds);
    this.businessOperationTotal.inc({ operation, status });
  }

  /**
   * Helper to measure duration of async operations
   */
  async measureDuration<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationSeconds = (Date.now() - start) / 1000;
      this.recordBusinessOperation(operation, durationSeconds, 'success');
      return result;
    } catch (error) {
      const durationSeconds = (Date.now() - start) / 1000;
      this.recordBusinessOperation(operation, durationSeconds, 'failure');
      throw error;
    }
  }
}

/**
 * Express middleware to automatically track HTTP metrics
 */
export function metricsMiddleware(metricsRegistry: MetricsRegistry) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Get request size
    const requestSize = parseInt(req.get('content-length') || '0', 10);

    // Capture the original end method
    const originalEnd = res.end;

    res.end = function (this: any, ...args: any[]) {
      // Calculate duration
      const durationSeconds = (Date.now() - start) / 1000;

      // Get response size
      const responseSize = parseInt(res.get('content-length') || '0', 10);

      // Get route (use req.route.path if available, otherwise req.path)
      const route = req.route?.path || req.path || 'unknown';

      // Record metrics
      metricsRegistry.recordHTTPRequest(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
        requestSize,
        responseSize
      );

      // Call original end method
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Express handler for /metrics endpoint
 */
export function metricsHandler(metricsRegistry: MetricsRegistry) {
  return async (_req: any, res: any) => {
    try {
      res.set('Content-Type', metricsRegistry.getRegistry().contentType);
      const metrics = await metricsRegistry.getMetrics();
      res.send(metrics);
    } catch (error) {
      log.error({ error }, 'Failed to get metrics');
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  };
}

/**
 * Create a metrics registry for a service
 */
export function createMetricsRegistry(serviceName: string, options?: Partial<MetricsOptions>): MetricsRegistry {
  return new MetricsRegistry({
    serviceName,
    ...options,
  });
}
