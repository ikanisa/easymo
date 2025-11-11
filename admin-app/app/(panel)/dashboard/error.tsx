'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('[DASHBOARD_ERROR]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-red-900">
            Dashboard Error
          </h2>
          <p className="text-sm text-red-700">
            Something went wrong while loading the dashboard.
          </p>
        </div>
        
        {error.message && (
          <div className="rounded-lg bg-red-100 p-3 text-left">
            <p className="text-xs font-mono text-red-800">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
