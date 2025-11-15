import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/monitoring/metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name') || undefined;
  const sinceParam = searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam, 10) : undefined;

  // Get all metrics or filtered
  const allMetrics = metrics.getMetrics(name, since);

  // Get stats for each unique metric name
  const uniqueNames = [...new Set(allMetrics.map((m) => m.name))];
  const stats: Record<string, ReturnType<typeof metrics.getStats>> = {};

  uniqueNames.forEach((metricName) => {
    stats[metricName] = metrics.getStats(metricName, since);
  });

  return NextResponse.json({
    metrics: allMetrics,
    stats,
    count: allMetrics.length,
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
