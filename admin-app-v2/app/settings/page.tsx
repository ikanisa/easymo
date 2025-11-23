"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { SettingsForm } from "@/components/features/settings/SettingsForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure system preferences and general settings.
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <SettingsForm />
          </TabsContent>

          <TabsContent value="security">
            <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
              Security settings will be implemented here.
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
              Notification settings will be implemented here.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
