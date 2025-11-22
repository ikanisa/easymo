"use client";

import { useId } from "react";

import { useRecentTransactions } from "@/src/v2/lib/supabase/hooks";

export function RecentActivity() {
  const { data, isLoading, error } = useRecentTransactions(6);
  const headingId = useId();

  if (isLoading) {
    return (
      <section
        aria-labelledby={headingId}
        aria-busy="true"
        className="rounded-lg border border-gray-200 bg-white p-6"
      >
        <h2 id={headingId} className="text-lg font-semibold text-gray-900">
          Recent Activity
        </h2>
        <div className="mt-4 animate-pulse space-y-3" role="status">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-gray-100" />
          ))}
          <span className="visually-hidden">Loading recent transactions</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-labelledby={headingId}
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        role="alert"
      >
        <h2 id={headingId} className="text-base font-semibold text-red-800">
          Recent Activity unavailable
        </h2>
        <p>Unable to load recent activity. Please check your Supabase configuration.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-gray-200 bg-white"
    >
      <header className="border-b border-gray-200 p-6">
        <h2 id={headingId} className="text-lg font-semibold text-gray-900">
          Recent Activity
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Latest transactions recorded in the last 30 days.
        </p>
      </header>
      <ul className="divide-y divide-gray-200" aria-live="polite">
        {data?.map((transaction) => (
          <li key={transaction.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {transaction.description ?? "Wallet transaction"}
              </p>
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
          <li className="px-6 py-12 text-center text-sm text-gray-500">
            No recent transactions.
          </li>
        )}
      </ul>
    </section>
  );
}
