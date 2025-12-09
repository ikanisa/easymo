"use client";

import { useMemo } from "react";
import { Trans } from "@/components/common/trans";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

export interface PollerIssue {
  id: string;
  name: string;
  status: string;
  lastPolledAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
}

export interface GatewayIssue {
  id: string;
  name: string;
  status: string;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
}

export interface AutomationHealthBannerProps {
  pollers: PollerIssue[];
  gateways: GatewayIssue[];
}

function formatRelative(value: string | null) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const delta = Date.now() - parsed;
  if (delta < 0) return new Date(parsed).toLocaleString();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AutomationHealthBanner({ pollers, gateways }: AutomationHealthBannerProps) {
  const { t } = useTranslation();

  const issues = useMemo(() => {
    const pollerItems = pollers.map((poller) => ({
      id: `poller-${poller.id}`,
      name: poller.name,
      description:
        poller.status === "ACTIVE"
          ? t("admin.reconciliation.momoFailure", "Polling stalled; latest run failed.")
          : t("admin.reconciliation.momoDisabled", "Polling paused for this integration."),
      detail: poller.lastError ?? null,
      since: poller.lastPolledAt,
    }));

    const gatewayItems = gateways.map((gateway) => ({
      id: `gateway-${gateway.id}`,
      name: gateway.name,
      description:
        gateway.status === "UP"
          ? t("admin.reconciliation.gatewayDegraded", "Heartbeat degraded; awaiting recovery.")
          : t("admin.reconciliation.gatewayDown", "Gateway unreachable; SMS ingest impacted."),
      detail: gateway.lastError ?? null,
      since: gateway.lastHeartbeatAt,
    }));

    return [...pollerItems, ...gatewayItems];
  }, [gateways, pollers, t]);

  if (issues.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="automation-health-banner"
      role="alert"
      className={cn(
        "rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-500/20 to-transparent p-4 text-sm text-rose-100 shadow-lg",
        "ring-1 ring-inset ring-rose-500/10"
      )}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600/70 text-xs font-bold">
          !
        </span>
        <p className="font-semibold">
          <Trans
            i18nKey="admin.reconciliation.automationIssues"
            fallback="Automation attention required"
            className="tracking-tight"
          />
        </p>
      </header>
      <ul className="space-y-2">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-lg bg-white/5 p-3 text-xs text-rose-50/90">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{issue.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-rose-100/60">
                {t("admin.reconciliation.lastSeen", "Last signal")}: {formatRelative(issue.since)}
              </span>
            </div>
            <p className="mt-1 text-rose-50/90">{issue.description}</p>
            {issue.detail ? <p className="mt-1 text-rose-200/70">{issue.detail}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
