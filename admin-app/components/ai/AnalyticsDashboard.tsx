"use client";

import { useState, useEffect } from "react";

export function AnalyticsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"all" | "usage" | "errors" | "performance">("all");

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [type]);

  const loadAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics?type=${type}`);
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading analytics...</div>;
  }

  if (!data) {
    return <div className="p-6">No data available</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI Analytics Dashboard</h1>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {["all", "usage", "errors", "performance"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t as any)}
            className={`px-4 py-2 rounded ${
              type === t
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {type === "all" && data.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card title="Total Requests" value={data.summary.totalRequests} />
          <Card title="Total Errors" value={data.summary.totalErrors} color="red" />
          <Card
            title="Avg Response Time"
            value={`${Math.round(data.summary.avgResponseTime)}ms`}
          />
          <Card
            title="Success Rate"
            value={`${data.summary.successRate.toFixed(1)}%`}
            color="green"
          />
        </div>
      )}

      {/* Usage Stats */}
      {data.usage && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Usage Statistics</h2>
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total Requests" value={data.usage.totalRequests} />
              <Stat label="Successful" value={data.usage.successfulRequests} />
              <Stat label="Failed" value={data.usage.failedRequests} />
              <Stat label="Total Tokens" value={data.usage.totalTokens} />
              <Stat label="Total Cost" value={`$${data.usage.totalCost.toFixed(4)}`} />
              <Stat
                label="Avg Duration"
                value={`${Math.round(data.usage.averageDuration)}ms`}
              />
            </div>

            {data.usage.byProvider && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">By Provider</h3>
                <div className="flex gap-4">
                  {Object.entries(data.usage.byProvider).map(([provider, count]) => (
                    <div key={provider} className="text-sm">
                      <span className="font-mono">{provider}:</span> {count as number}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Stats */}
      {data.errors && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Error Statistics</h2>
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="Total Errors" value={data.errors.total} />
            </div>

            {data.errors.byType && Object.keys(data.errors.byType).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">By Error Type</h3>
                {Object.entries(data.errors.byType).map(([type, count]) => (
                  <div key={type} className="text-sm mb-1">
                    <span className="font-mono">{type}:</span> {count as number}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Stats */}
      {data.overall && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Performance Metrics</h2>
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total Calls" value={data.overall.count} />
              <Stat label="Avg Duration" value={`${Math.round(data.overall.avgDuration)}ms`} />
              <Stat label="Min Duration" value={`${data.overall.minDuration}ms`} />
              <Stat label="Max Duration" value={`${data.overall.maxDuration}ms`} />
              <Stat label="P50" value={`${data.overall.p50}ms`} />
              <Stat label="P95" value={`${data.overall.p95}ms`} />
              <Stat label="P99" value={`${data.overall.p99}ms`} />
              <Stat label="Success Rate" value={`${data.overall.successRate.toFixed(1)}%`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, color = "blue" }: any) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
    green: "bg-green-50 border-green-200",
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
