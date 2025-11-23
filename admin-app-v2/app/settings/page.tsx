// Settings page – placeholder for admin settings
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-4 text-gray-600">Admin settings will be configured here.</p>
      </div>
    </DashboardLayout>
  );
}
