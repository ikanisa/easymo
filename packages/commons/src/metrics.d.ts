import { Counter, Gauge, Histogram, Registry } from 'prom-client';
export interface MetricsOptions {
    serviceName: string;
    defaultLabels?: Record<string, string>;
    collectDefaultMetrics?: boolean;
}
export declare class MetricsRegistry {
    private registry;
    private serviceName;
    httpRequestDuration: Histogram;
    httpRequestTotal: Counter;
    httpRequestSize: Histogram;
    httpResponseSize: Histogram;
    businessOperationTotal: Counter;
    businessOperationDuration: Histogram;
    activeConnections: Gauge;
    queueSize: Gauge;
    constructor(options: MetricsOptions);
    /**
     * Get metrics in Prometheus format
     */
    getMetrics(): Promise<string>;
    /**
     * Get metrics as JSON
     */
    getMetricsJSON(): Promise<any>;
    /**
     * Reset all metrics (useful for testing)
     */
    resetMetrics(): void;
    /**
     * Get the underlying registry
     */
    getRegistry(): Registry;
    /**
     * Record HTTP request metrics
     */
    recordHTTPRequest(method: string, route: string, statusCode: number, durationSeconds: number, requestSize?: number, responseSize?: number): void;
    /**
     * Record business operation metrics
     */
    recordBusinessOperation(operation: string, durationSeconds: number, status: 'success' | 'failure'): void;
    /**
     * Helper to measure duration of async operations
     */
    measureDuration<T>(operation: string, fn: () => Promise<T>): Promise<T>;
}
/**
 * Express middleware to automatically track HTTP metrics
 */
export declare function metricsMiddleware(metricsRegistry: MetricsRegistry): (req: any, res: any, next: any) => void;
/**
 * Express handler for /metrics endpoint
 */
export declare function metricsHandler(metricsRegistry: MetricsRegistry): (_req: any, res: any) => Promise<void>;
/**
 * Create a metrics registry for a service
 */
export declare function createMetricsRegistry(serviceName: string, options?: Partial<MetricsOptions>): MetricsRegistry;
//# sourceMappingURL=metrics.d.ts.map