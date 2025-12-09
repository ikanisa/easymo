// ═══════════════════════════════════════════════════════════════════════════
// Stats API Client
// ═══════════════════════════════════════════════════════════════════════════

import type { PaymentStats } from "@/types/payment";

export async function fetchStats(
  sacco_id: string,
  days = 30
): Promise<{ data: PaymentStats; period_days: number; generated_at: string }> {
  const searchParams = new URLSearchParams({
    sacco_id,
    days: String(days),
  });

  const response = await fetch(`/api/stats?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch statistics");
  }

  return response.json();
}
