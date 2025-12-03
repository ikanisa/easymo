"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";

interface Device {
  id: string;
  device_id: string;
  device_name: string | null;
  app_version: string | null;
  last_seen_at: string;
  status: "active" | "inactive" | "blocked";
  transaction_count: number;
  merchant?: { id: string; phone: string; full_name: string };
}

async function fetchDevices(params: { page: number; status?: string; search?: string }) {
  const searchParams = new URLSearchParams({ page: String(params.page), per_page: "20" });
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  const res = await fetch(`/api/admin/momo-devices?${searchParams}`);
  return res.json();
}

async function updateDeviceStatus(id: string, status: string) {
  const res = await fetch(`/api/admin/momo-devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export default function MomoDevicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["momo-devices", page, status, search],
    queryFn: () => fetchDevices({ page, status: status || undefined, search: search || undefined }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateDeviceStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["momo-devices"] }),
  });

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = { active: "bg-green-100 text-green-800", inactive: "bg-yellow-100 text-yellow-800", blocked: "bg-red-100 text-red-800" };
    return <Badge className={colors[s] || ""}>{s}</Badge>;
  };

  const formatLastSeen = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">MomoTerminal Devices</h1>
        <Button onClick={() => window.location.href = "/api/admin/momo-devices/export"}>Export CSV</Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Device ID</th>
                  <th className="text-left py-2">Merchant</th>
                  <th className="text-left py-2">Last Seen</th>
                  <th className="text-left py-2">Transactions</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.devices?.map((device: Device) => (
                  <tr key={device.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      <div className="font-mono text-sm">{device.device_id.slice(0, 12)}...</div>
                      {device.device_name && <div className="text-xs text-gray-500">{device.device_name}</div>}
                    </td>
                    <td className="py-3">{device.merchant?.full_name || "—"}</td>
                    <td className="py-3">{formatLastSeen(device.last_seen_at)}</td>
                    <td className="py-3">{device.transaction_count}</td>
                    <td className="py-3">{getStatusBadge(device.status)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.location.href = `/momo-terminal/devices/${device.id}`}>View</Button>
                        {device.status !== "blocked" ? (
                          <Button size="sm" variant="destructive" onClick={() => mutation.mutate({ id: device.id, status: "blocked" })}>Block</Button>
                        ) : (
                          <Button size="sm" onClick={() => mutation.mutate({ id: device.id, status: "active" })}>Unblock</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">Total: {data?.total || 0} devices</div>
              <div className="flex gap-2">
                <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button disabled={!data?.devices?.length || data.devices.length < 20} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
