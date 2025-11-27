"use client";

import { useMemo } from "react";

import { useRealtimeSlaAlerts } from "@/lib/hooks/useRealtimeSlaAlerts";
import { useIntegrationStatusQuery } from "@/lib/queries/integrations";

interface BadgeMetrics {
  badgeValue: string;
  badgeLabel: string;
  isLoading: boolean;
  details: {
    degradedIntegrations: number;
    slaBreaches: number;
    negotiationAlerts: number;
  };
  error?: string | null;
}

function summarise(
  degraded: number,
  breaches: number,
  negotiations: number,
): string {
  const parts: string[] = [];
  if (breaches > 0) {
    parts.push(`${breaches} SLA breach${breaches === 1 ? "" : "es"}`);
  }
  if (negotiations > 0) {
    parts.push(`${negotiations} negotiation${negotiations === 1 ? "" : "s"} escalating`);
  }
  if (degraded > 0) {
    parts.push(`${degraded} integration${degraded === 1 ? "" : "s"} degraded`);
  }
  if (parts.length === 0) {
    return "All integrations healthy";
  }
  return parts.join(" · ");
}

export function useIntegrationBadgeMetrics(): BadgeMetrics {
  const statusQuery = useIntegrationStatusQuery({ refetchInterval: 120_000 } as any);
  const realtime = useRealtimeSlaAlerts();

  return useMemo(() => {
    if (statusQuery.isLoading || realtime.isLoading) {
      return {
        badgeValue: "…",
        badgeLabel: "Checking integration health",
        isLoading: true,
        details: {
          degradedIntegrations: 0,
          slaBreaches: realtime.counts.breaches,
          negotiationAlerts: realtime.counts.negotiations,
        },
        error: statusQuery.error ? String(statusQuery.error) : realtime.error,
      } satisfies BadgeMetrics;
    }

    if (statusQuery.isError || !statusQuery.data) {
      return {
        badgeValue: "!",
        badgeLabel: "Unable to load integration status",
        isLoading: false,
        details: {
          degradedIntegrations: 0,
          slaBreaches: realtime.counts.breaches,
          negotiationAlerts: realtime.counts.negotiations,
        },
        error: statusQuery.error ? String(statusQuery.error) : realtime.error,
      } satisfies BadgeMetrics;
    }

    const degraded = Object.values(statusQuery.data).filter(
      (entry) => entry.status !== "green",
    ).length;

    const totalIssues = degraded + realtime.counts.total;
    const badgeValue = totalIssues > 9 ? "9+" : String(totalIssues);

    return {
      badgeValue,
      badgeLabel: summarise(degraded, realtime.counts.breaches, realtime.counts.negotiations),
      isLoading: false,
      details: {
        degradedIntegrations: degraded,
        slaBreaches: realtime.counts.breaches,
        negotiationAlerts: realtime.counts.negotiations,
      },
      error: realtime.error,
    } satisfies BadgeMetrics;
  }, [statusQuery.data, statusQuery.error, statusQuery.isError, statusQuery.isLoading, realtime]);
}
