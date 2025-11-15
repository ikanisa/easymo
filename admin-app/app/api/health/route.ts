import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    environment: boolean;
    session: boolean;
    rateLimit: boolean;
  };
  version?: string;
}

export async function GET() {
  const startTime = Date.now();
  
  const checks = {
    environment: checkEnvironment(),
    session: checkSession(),
    rateLimit: checkRateLimit(),
  };

  const allHealthy = Object.values(checks).every(Boolean);
  const status: HealthCheck['status'] = allHealthy ? 'healthy' : 'degraded';

  const health: HealthCheck = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.APP_VERSION || '1.0.0',
  };

  const responseTime = Date.now() - startTime;

  return NextResponse.json(health, {
    status: status === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${responseTime}ms`,
    },
  });
}

function checkEnvironment(): boolean {
  return !!(
    process.env.ADMIN_SESSION_SECRET &&
    process.env.ADMIN_SESSION_SECRET.length >= 32
  );
}

function checkSession(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/lib/server/session');
    return true;
  } catch {
    return false;
  }
}

function checkRateLimit(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/lib/server/rate-limit');
    return true;
  } catch {
    return false;
  }
}
