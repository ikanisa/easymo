"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface AuditEvent {
  id: string;
  event_type: string;
  device_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

async function fetchAuditLog(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && searchParams.set(k, String(v)));
  const res = await fetch(`/api/admin/security-audit?${searchParams}`);
  return res.json();
}

export default function SecurityAuditPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [deviceId, setDeviceId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["security-audit", page, eventType, deviceId],
    queryFn: () => fetchAuditLog({ page, per_page: 50, event_type: eventType || undefined, device_id: deviceId || undefined }),
  });

  const getEventBadge = (type: string) => {
    const colors: Record<string, string> = {
      REPLAY_ATTACK_BLOCKED: "bg-red-100 text-red-800",
      SIGNATURE_MISMATCH: "bg-yellow-100 text-yellow-800",
      RATE_LIMITED: "bg-orange-100 text-orange-800",
      DEVICE_REGISTERED: "bg-green-100 text-green-800",
    };
    return <Badge className={colors[type] || "bg-gray-100"}>{type}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Security Audit Log</h1>

      <Card className="p-4">
        <div className="flex gap-4 mb-4 flex-wrap">
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All Events</option>
            <option value="REPLAY_ATTACK_BLOCKED">Replay Attack Blocked</option>
            <option value="SIGNATURE_MISMATCH">Signature Mismatch</option>
            <option value="RATE_LIMITED">Rate Limited</option>
            <option value="DEVICE_REGISTERED">Device Registered</option>
          </Select>
          <Input placeholder="Filter by device ID..." value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="max-w-xs" />
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Event</th>
                  <th className="text-left py-2">Device</th>
                  <th className="text-left py-2">IP Address</th>
                  <th className="text-left py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {data?.events?.map((evt: AuditEvent) => (
                  <tr key={evt.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 text-sm">{new Date(evt.created_at).toLocaleString()}</td>
                    <td className="py-3">{getEventBadge(evt.event_type)}</td>
                    <td className="py-3 font-mono text-xs">{evt.device_id?.slice(0, 12) || "—"}</td>
                    <td className="py-3 text-sm">{evt.ip_address || "—"}</td>
                    <td className="py-3 text-sm text-gray-600 truncate max-w-xs">{JSON.stringify(evt.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">Total: {data?.total || 0} events</div>
              <div className="flex gap-2">
                <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button disabled={!data?.events?.length || data.events.length < 50} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
