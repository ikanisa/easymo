/**
 * Health Check Module for EasyMO Services
 * Provides standardized health, liveness, and readiness endpoints
 */
export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, CheckResult>;
    timestamp: string;
    version?: string;
    uptime?: number;
}
export interface CheckResult {
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    latencyMs?: number;
}
export interface HealthCheckOptions {
    database?: () => Promise<boolean>;
    redis?: () => Promise<boolean>;
    kafka?: () => Promise<boolean>;
    external?: Record<string, () => Promise<boolean>>;
    version?: string;
}
/**
 * Create a health check function with dependency checks
 */
export declare function createHealthCheck(options: HealthCheckOptions): Promise<() => Promise<HealthCheckResult>>;
//# sourceMappingURL=index.d.ts.map