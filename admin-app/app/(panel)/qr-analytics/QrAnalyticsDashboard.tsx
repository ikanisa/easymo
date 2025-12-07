'use client';

interface QrAnalyticsDashboardProps {
  analytics: {
    topScanned: any[];
    recentScans: any[];
    totalTokens: number;
    totalScans: number;
    unusedTokens: any[];
  };
}

export function QrAnalyticsDashboard({ analytics }: QrAnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Tokens</h3>
          <p className="mt-2 text-3xl font-semibold">{analytics.totalTokens}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Scans</h3>
          <p className="mt-2 text-3xl font-semibold">{analytics.totalScans}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Unused Tokens</h3>
          <p className="mt-2 text-3xl font-semibold">{analytics.unusedTokens.length}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Top Scanned QR Codes</h2>
        <div className="space-y-2">
          {analytics.topScanned.length === 0 ? (
            <p className="text-gray-500">No scans yet</p>
          ) : (
            analytics.topScanned.map((token: any) => (
              <div key={token.id} className="flex justify-between items-center border-b pb-2">
                <span>{token.table_label}</span>
                <span className="font-semibold">{token.scan_count} scans</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
