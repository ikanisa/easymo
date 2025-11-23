// Dashboard page – minimalistic overview
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-4 text-gray-600">
          Welcome to the easyMO admin panel. Use the navigation to access different sections.
        </p>
        {/* Add quick summary cards or stats here later */}
      </div>
    </DashboardLayout>
  );
}
