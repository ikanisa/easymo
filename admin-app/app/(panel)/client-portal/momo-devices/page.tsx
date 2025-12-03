"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useState } from "react";

interface Device {
  id: string;
  device_id: string;
  device_name: string | null;
  app_version: string | null;
  last_seen_at: string;
  status: string;
  transaction_count: number;
}

async function fetchDevices() {
  const res = await fetch("/api/merchant/devices");
  return res.json();
}

async function updateDeviceName(deviceId: string, name: string) {
  const res = await fetch("/api/merchant/devices", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, device_name: name }),
  });
  return res.json();
}

export default function MerchantDevicesPage() {
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-devices"],
    queryFn: fetchDevices,
  });

  const mutation = useMutation({
    mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) => updateDeviceName(deviceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-devices"] });
      setEditingDevice(null);
    },
  });

  const getStatusInfo = (device: Device) => {
    const lastSeen = new Date(device.last_seen_at).getTime();
    const diff = Date.now() - lastSeen;
    if (diff < 300000) return { status: "🟢 Online", color: "text-green-600", label: "just now" };
    if (diff < 3600000) return { status: "🟡 Idle", color: "text-yellow-600", label: `${Math.floor(diff / 60000)} min ago` };
    return { status: "🔴 Offline", color: "text-red-600", label: `${Math.floor(diff / 3600000)} hours ago` };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Devices</h1>
        <Button onClick={() => window.location.href = "/client-portal/momo-devices/add"}>+ Add New Device</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-4">
          {data?.devices?.map((device: Device) => {
            const statusInfo = getStatusInfo(device);
            return (
              <Card key={device.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">📱</div>
                    <div>
                      {editingDevice === device.device_id ? (
                        <div className="flex gap-2">
                          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Device name" className="w-48" />
                          <Button size="sm" onClick={() => mutation.mutate({ deviceId: device.device_id, name: newName })}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingDevice(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="font-semibold text-lg">{device.device_name || "Unnamed Device"}</div>
                      )}
                      <div className={`text-sm ${statusInfo.color}`}>
                        Status: {statusInfo.status} (last seen: {statusInfo.label})
                      </div>
                      <div className="text-sm text-gray-500">
                        App Version: {device.app_version || "Unknown"}
                        {device.app_version && device.app_version < "2.0.1" && (
                          <Badge className="ml-2 bg-yellow-100 text-yellow-800">⚠️ Update available</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">Today: {device.transaction_count} transactions synced</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingDevice(device.device_id); setNewName(device.device_name || ""); }}>
                      Rename
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {(!data?.devices || data.devices.length === 0) && (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-4">📱</div>
              <div className="text-lg font-medium mb-2">No devices registered</div>
              <div className="text-gray-500 mb-4">Download MomoTerminal app and register your first device</div>
              <Button>+ Add New Device</Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
