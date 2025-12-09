export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage SACCO configuration and preferences
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">SACCO Information</h3>
            <p className="mt-1 text-sm text-gray-500">
              Update your SACCO&apos;s basic information
            </p>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <p className="text-gray-500 text-center py-12">
              Settings form will be displayed here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
