/**
 * Health Check Module for EasyMO Services
 * Provides standardized health, liveness, and readiness endpoints
 */
/**
 * Create a health check function with dependency checks
 */
export async function createHealthCheck(options) {
    const startTime = Date.now();
    return async function healthCheck() {
        const checks = {};
        let overallStatus = 'healthy';
        // Database check (critical)
        if (options.database) {
            const start = Date.now();
            try {
                const ok = await Promise.race([
                    options.database(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
                ]);
                checks.database = {
                    status: ok ? 'pass' : 'fail',
                    latencyMs: Date.now() - start,
                };
                if (!ok)
                    overallStatus = 'unhealthy';
            }
            catch (error) {
                checks.database = {
                    status: 'fail',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    latencyMs: Date.now() - start,
                };
                overallStatus = 'unhealthy';
            }
        }
        // Redis check (non-critical)
        if (options.redis) {
            const start = Date.now();
            try {
                const ok = await Promise.race([
                    options.redis(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
                ]);
                checks.redis = {
                    status: ok ? 'pass' : 'warn',
                    latencyMs: Date.now() - start,
                };
                if (!ok && overallStatus === 'healthy')
                    overallStatus = 'degraded';
            }
            catch (error) {
                checks.redis = {
                    status: 'warn',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    latencyMs: Date.now() - start,
                };
                if (overallStatus === 'healthy')
                    overallStatus = 'degraded';
            }
        }
        // Kafka check (non-critical)
        if (options.kafka) {
            const start = Date.now();
            try {
                const ok = await Promise.race([
                    options.kafka(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
                ]);
                checks.kafka = {
                    status: ok ? 'pass' : 'warn',
                    latencyMs: Date.now() - start,
                };
                if (!ok && overallStatus === 'healthy')
                    overallStatus = 'degraded';
            }
            catch (error) {
                checks.kafka = {
                    status: 'warn',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    latencyMs: Date.now() - start,
                };
                if (overallStatus === 'healthy')
                    overallStatus = 'degraded';
            }
        }
        // External service checks
        if (options.external) {
            for (const [name, checkFn] of Object.entries(options.external)) {
                const start = Date.now();
                try {
                    const ok = await checkFn();
                    checks[name] = {
                        status: ok ? 'pass' : 'warn',
                        latencyMs: Date.now() - start,
                    };
                }
                catch (error) {
                    checks[name] = {
                        status: 'warn',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        latencyMs: Date.now() - start,
                    };
                }
            }
        }
        return {
            status: overallStatus,
            checks,
            timestamp: new Date().toISOString(),
            version: options.version || process.env.APP_VERSION || 'unknown',
            uptime: Math.floor((Date.now() - startTime) / 1000),
        };
    };
}
