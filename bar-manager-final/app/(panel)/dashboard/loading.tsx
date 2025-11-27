export default function DashboardLoading() {
  return (
    <div className="min-h-screen p-8">
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded-lg w-48"></div>
          <div className="h-4 bg-gray-100 rounded w-96"></div>
        </div>

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-24"></div>
              <div className="h-8 bg-gray-200 rounded w-32"></div>
              <div className="h-3 bg-gray-100 rounded w-20"></div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
