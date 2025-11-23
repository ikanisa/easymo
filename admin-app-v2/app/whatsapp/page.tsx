"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { HealthMonitor } from "@/components/features/whatsapp/HealthMonitor";
import { MenuBuilder } from "@/components/features/whatsapp/MenuBuilder";

export default function WhatsAppPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system health and configure WhatsApp menus.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <HealthMonitor />
          <MenuBuilder />
        </div>
      </div>
    </DashboardLayout>
  );
}
