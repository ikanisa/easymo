"use client";

import { Trans } from "@/components/common/trans";
import { GlassCard } from "@/components/ui/glass-card";
import { TrendingUp, CheckCircle, Clock } from "lucide-react";

interface MomoInboxStatsProps {
  totalReceived: number;
  matchedCount: number;
  pendingCount: number;
}

export function MomoInboxStats({
  totalReceived,
  matchedCount,
  pendingCount,
}: MomoInboxStatsProps) {
  const matchRate = totalReceived > 0 ? ((matchedCount / totalReceived) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Received */}
      <GlassCard>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Trans k="momoInbox.stats.total" defaultText="Total Received" />
            </p>
            <p className="text-3xl font-bold mt-1">{totalReceived}</p>
          </div>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </GlassCard>

      {/* Matched */}
      <GlassCard>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Trans k="momoInbox.stats.matched" defaultText="Auto-Matched" />
            </p>
            <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
              {matchedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">{matchRate}% match rate</p>
          </div>
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </GlassCard>

      {/* Pending */}
      <GlassCard>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Trans k="momoInbox.stats.pending" defaultText="Needs Review" />
            </p>
            <p className="text-3xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              {pendingCount}
            </p>
          </div>
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
