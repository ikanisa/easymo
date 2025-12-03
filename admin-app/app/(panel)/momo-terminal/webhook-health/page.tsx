"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";

interface WebhookStats {
  period: string;
  received: number;
  processed: number;
  failed: number;
  duplicates_blocked: number;
  replay_attacks_blocked: number;
  avg_latency_ms: number;
  error_breakdown: { signature_mismatch: number; replay_blocked: number; rate_limited: number };
}

interface WebhookError {
  timestamp: string;
  error_type: string;
  device_id: string;
  details: string;
  request_id: string;
}

async function fetchStats(period: string): Promise<WebhookStats> {
  const res = await fetch(`/api/admin/webhook-stats?period=${period}`);
  return res.json();
}

async function fetchErrors(page: number) {
  const res = await fetch(`/api/admin/webhook-stats/errors?page=${page}&per_page=20`);
  return res.json();
}

export default function WebhookHealthPage() {
  const [period, setPeriod] = useState("24h");
  const [errorsPage, setErrorsPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["webhook-stats", period],
    queryFn: () => fetchStats(period),
    refetchInterval: 30000,
  });

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: ["webhook-errors", errorsPage],
    queryFn: () => fetchErrors(errorsPage),
  });

  const successRate = stats ? Math.round((stats.processed / Math.max(stats.received, 1)) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Webhook Health</h1>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </Select>
      </div>

      {statsLoading ? (
        <div className="text-center py-8">Loading stats...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Received</div>
              <div className="text-3xl font-bold">{stats.received.toLocaleString()}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Processed</div>
              <div className="text-3xl font-bold text-green-600">{stats.processed.toLocaleString()}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Failed</div>
              <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Avg Latency</div>
              <div className="text-3xl font-bold">{stats.avg_latency_ms}ms</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Success Rate</h3>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold" style={{ color: successRate > 95 ? "green" : successRate > 80 ? "orange" : "red" }}>
                  {successRate}%
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div className="bg-green-500 h-4 rounded-full" style={{ width: `${successRate}%` }} />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Security Events</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Duplicates Blocked</span>
                  <Badge>{stats.duplicates_blocked}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Replay Attacks Blocked</span>
                  <Badge className="bg-red-100 text-red-800">{stats.replay_attacks_blocked}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Signature Mismatches</span>
                  <Badge className="bg-yellow-100 text-yellow-800">{stats.error_breakdown.signature_mismatch}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Recent Errors</h3>
        {errorsLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Error Type</th>
                  <th className="text-left py-2">Device</th>
                  <th className="text-left py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {errors?.errors?.map((err: WebhookError, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 text-sm">{new Date(err.timestamp).toLocaleString()}</td>
                    <td className="py-2">
                      <Badge className={err.error_type === "REPLAY_ATTACK_BLOCKED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                        {err.error_type}
                      </Badge>
                    </td>
                    <td className="py-2 font-mono text-xs">{err.device_id?.slice(0, 8) || "—"}...</td>
                    <td className="py-2 text-sm text-gray-600 truncate max-w-xs">{err.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2 mt-4">
              <Button disabled={errorsPage === 1} onClick={() => setErrorsPage(errorsPage - 1)}>Previous</Button>
              <Button onClick={() => setErrorsPage(errorsPage + 1)}>Next</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
