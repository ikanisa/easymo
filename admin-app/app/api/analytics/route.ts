import { NextRequest, NextResponse } from "next/server";

import { errorMonitor } from "@/lib/monitoring/error-monitor";
import { performanceMonitor } from "@/lib/monitoring/performance";
import { usageTracker } from "@/lib/monitoring/usage-tracker";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") || "all";
    const since = searchParams.get("since");

    const sinceDate = since ? new Date(since) : undefined;

    let data: any = {};

    switch (type) {
      case "usage":
        data = {
          stats: usageTracker.getStats(sinceDate),
          recentEvents: usageTracker.getRecentEvents(50),
        };
        break;

      case "errors":
        data = {
          stats: errorMonitor.getErrorStats(),
          recentErrors: errorMonitor.getErrors(50),
        };
        break;

      case "performance":
        data = {
          overall: performanceMonitor.getStats(),
          byEndpoint: {
            chat: performanceMonitor.getStats("/api/ai/chat"),
            agent: performanceMonitor.getStats("/api/ai/agent"),
            streaming: performanceMonitor.getStats("/api/ai/chat-stream"),
          },
          recentMetrics: performanceMonitor.getRecentMetrics(50),
        };
        break;

      case "all":
      default:
        data = {
          usage: usageTracker.getStats(sinceDate),
          errors: errorMonitor.getErrorStats(),
          performance: performanceMonitor.getStats(),
          summary: {
            totalRequests: usageTracker.getStats().totalRequests,
            totalErrors: errorMonitor.getErrorStats().total,
            avgResponseTime: performanceMonitor.getStats()?.avgDuration || 0,
            successRate: performanceMonitor.getStats()?.successRate || 0,
          },
        };
        break;
    }

    return NextResponse.json({
      success: true,
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
