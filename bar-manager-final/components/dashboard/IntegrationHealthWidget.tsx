"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { IntegrationStatusChip } from "@/components/ui/IntegrationStatusChip";
import { SectionCard } from "@/components/ui/SectionCard";
import { useIntegrationBadgeMetrics } from "@/lib/hooks/useIntegrationBadgeMetrics";
import {
  type IntegrationTarget,
  useIntegrationStatusQuery,
} from "@/lib/queries/integrations";

const TARGET_LABELS: Record<IntegrationTarget, string> = {
  whatsappSend: "WhatsApp sends",
  storageSignedUrl: "Storage signed URLs",
};

const DETAIL_LABELS = [
  { key: "degradedIntegrations", label: "Degraded integrations" },
  { key: "slaBreaches", label: "SLA breaches" },
  { key: "negotiationAlerts", label: "Escalations in progress" },
] as const;

export function IntegrationHealthWidget() {
  const badgeMetrics = useIntegrationBadgeMetrics();
  const statusQuery = useIntegrationStatusQuery();

  const totalIssues =
    badgeMetrics.details.degradedIntegrations +
    badgeMetrics.details.slaBreaches +
    badgeMetrics.details.negotiationAlerts;

  return (
    <SectionCard
      title="Integration health"
      description="Live status for WhatsApp sends, storage signing, and negotiation SLAs sourced from Supabase telemetry."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/tools">Open tools</Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <article
          className="rounded-2xl border border-[color:var(--color-border)]/70 bg-[color:var(--color-surface)]/85 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Alert summary
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
              {badgeMetrics.badgeValue}
            </span>
            <span className="rounded-full border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface-muted)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted)]">
              {badgeMetrics.isLoading
                ? "Checking integrations"
                : totalIssues === 0
                ? "Healthy"
                : "Attention needed"}
            </span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            {badgeMetrics.badgeLabel}
          </p>
          {badgeMetrics.error
            ? (
              <p className="mt-2 text-sm text-red-500">
                {badgeMetrics.error}
              </p>
            )
            : null}

          <dl className="mt-6 grid gap-3 md:grid-cols-3">
            {DETAIL_LABELS.map((detail) => (
              <div
                key={detail.key}
                className="rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface-muted)]/70 px-4 py-3"
              >
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                  {detail.label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">
                  {badgeMetrics.isLoading
                    ? "…"
                    : badgeMetrics.details[detail.key]}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-2xl border border-[color:var(--color-border)]/70 bg-[color:var(--color-surface-muted)]/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Monitored systems
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(Object.entries(TARGET_LABELS) as Array<[IntegrationTarget, string]>).map(
              ([target, label]) => (
                <IntegrationStatusChip
                  key={target}
                  label={label}
                  status={statusQuery.data?.[target]}
                  isLoading={statusQuery.isLoading}
                />
              ),
            )}
          </div>
        </article>
      </div>
    </SectionCard>
  );
}
