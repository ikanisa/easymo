import { Logger } from './logger';

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

export async function createHealthCheck(options: HealthCheckOptions) {
  const startTime = Date.now();
  const log = new Logger({ service: 'health-check' });

  return async function healthCheck(): Promise<HealthCheckResult> {
    const checks: Record<string, CheckResult> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    if (options.database) {
      const start = Date.now();
      try {
        const ok = await Promise.race([
          options.database(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          ),
        ]);
        checks.database = {
          status: ok ? 'pass' : 'fail',
          latencyMs: Date.now() - start,
        };
        if (!ok) overallStatus = 'unhealthy';
      } catch (error) {
        checks.database = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          latencyMs: Date.now() - start,
        };
        overallStatus = 'unhealthy';
      }
    }

    // Redis check
    if (options.redis) {
      const start = Date.now();
      try {
        const ok = await Promise.race([
          options.redis(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          ),
        ]);
        checks.redis = {
          status: ok ? 'pass' : 'warn',
          latencyMs: Date.now() - start,
        };
        if (!ok && overallStatus === 'healthy') overallStatus = 'degraded';
      } catch (error) {
        checks.redis = {
          status: 'warn',
          message: error instanceof Error ? error.message : 'Unknown error',
          latencyMs: Date.now() - start,
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    }

    // Kafka check
    if (options.kafka) {
      const start = Date.now();
      try {
        const ok = await Promise.race([
          options.kafka(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          ),
        ]);
        checks.kafka = {
          status: ok ? 'pass' : 'warn',
          latencyMs: Date.now() - start,
        };
        if (!ok && overallStatus === 'healthy') overallStatus = 'degraded';
      } catch (error) {
        checks.kafka = {
          status: 'warn',
          message: error instanceof Error ? error.message : 'Unknown error',
          latencyMs: Date.now() - start,
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
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
        } catch (error) {
          checks[name] = {
            status: 'warn',
            message: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - start,
          };
        }
      }
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      version: options.version,
      uptime: Date.now() - startTime,
    };

    // Log if unhealthy
    if (overallStatus !== 'healthy') {
      log.warn({ result }, 'Health check degraded or unhealthy');
    }

    return result;
  };
}

export function healthCheckMiddleware(healthCheck: () => Promise<HealthCheckResult>) {
  return async (req: Request): Promise<Response> => {
    const result = await healthCheck();
    
    const statusCode = result.status === 'healthy' ? 200 : 
                       result.status === 'degraded' ? 200 : 503;
    
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  };
}
