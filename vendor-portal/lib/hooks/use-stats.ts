// ═══════════════════════════════════════════════════════════════════════════
// useStats - React Query hooks for statistics
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchStats } from "@/lib/api/stats";

export function useStats(sacco_id: string, days = 30) {
  return useQuery({
    queryKey: ["stats", sacco_id, days],
    queryFn: () => fetchStats(sacco_id, days),
    enabled: !!sacco_id,
    refetchInterval: 60000, // Refresh every minute
  });
}
