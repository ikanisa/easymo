"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useState } from "react";

export function SettingsForm() {
  const [settings, setSettings] = useState({
    siteName: "easyMO Admin",
    supportEmail: "support@easymo.com",
    maxUploadSize: "10",
    maintenanceMode: false,
  });

  const handleChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
      <div className="mt-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Input
            label="Site Name"
            value={settings.siteName}
            onChange={(e) => handleChange("siteName", e.target.value)}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.supportEmail}
            onChange={(e) => handleChange("supportEmail", e.target.value)}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Input
            label="Max Upload Size (MB)"
            type="number"
            value={settings.maxUploadSize}
            onChange={(e) => handleChange("maxUploadSize", e.target.value)}
          />
          <div className="flex items-center space-x-3 pt-8">
            <input
              type="checkbox"
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={(e) =>
                handleChange("maintenanceMode", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label
              htmlFor="maintenanceMode"
              className="text-sm font-medium text-gray-900"
            >
              Maintenance Mode
            </label>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </Card>
  );
}
