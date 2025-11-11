export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Growth metrics, geographic distribution, and rider performance dashboards are coming soon.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
        Connect Supabase analytics tables to power this view. Until then, use the dashboard overview to monitor real-time activity.
      </div>
    </div>
  );
}
