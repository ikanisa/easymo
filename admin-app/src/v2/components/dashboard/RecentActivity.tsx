"use client";

import { useRecentTransactions } from "@/src/v2/lib/supabase/hooks";

export function RecentActivity() {
  const { data, isLoading, error } = useRecentTransactions(6);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load recent activity. Please check your Supabase configuration.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <p className="mt-1 text-sm text-gray-500">Latest transactions recorded in the last 30 days.</p>
      </div>
      <ul className="divide-y divide-gray-200">
        {data?.map((transaction) => (
          <li key={transaction.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{transaction.description ?? "Wallet transaction"}</p>
              <p className="text-xs text-gray-500">
                {new Date(transaction.created_at).toLocaleString()}
              </p>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              ${transaction.amount.toFixed(2)}
            </span>
          </li>
        ))}
        {(data?.length ?? 0) === 0 && (
          <li className="px-6 py-12 text-center text-sm text-gray-500">No recent transactions.</li>
        )}
      </ul>
    </div>
  );
}
