// ═══════════════════════════════════════════════════════════════════════════
// Payment Statistics Cards
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { formatCurrency } from "@/lib/utils";
import type { PaymentStats } from "@/types/payment";

interface PaymentStatsProps {
  stats: PaymentStats;
  isLoading?: boolean;
}

export function PaymentStatsCards({ stats, isLoading }: PaymentStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Payments",
      value: formatCurrency(stats.payments.total_amount),
      subtitle: `${stats.payments.total.toLocaleString()} transactions`,
      trend: stats.payments.today_count > 0 ? `+${stats.payments.today_count} today` : null,
    },
    {
      title: "Total Savings",
      value: formatCurrency(stats.savings.total),
      subtitle: `${stats.members.total} active members`,
      trend: null,
    },
    {
      title: "Match Rate",
      value: `${stats.payments.match_rate.toFixed(1)}%`,
      subtitle: `${stats.payments.matched} matched`,
      trend: stats.payments.unmatched > 0 ? `${stats.payments.unmatched} pending` : "All matched",
      trendColor: stats.payments.unmatched > 0 ? "text-orange-600" : "text-green-600",
    },
    {
      title: "Today's Payments",
      value: formatCurrency(stats.payments.today_amount),
      subtitle: `${stats.payments.today_count} transactions`,
      trend: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <div key={index} className="rounded-lg border bg-card p-6">
          <div className="flex flex-col space-y-1.5">
            <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            {card.trend && (
              <p className={`text-xs font-medium ${card.trendColor || "text-muted-foreground"}`}>
                {card.trend}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
