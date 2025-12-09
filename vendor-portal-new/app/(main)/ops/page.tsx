import { Fragment } from "react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { requireUserAndProfile } from "@/lib/auth";
import { Trans } from "@/components/common/trans";
import { Sparkline } from "@/components/ui/sparkline";
import type { TrendPoint } from "@/lib/operations/dashboard";
import { getOperationsSnapshot } from "@/lib/operations/dashboard";

const numberFormatter = new Intl.NumberFormat("en-RW");

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "—";
  }

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 14) {
    return `${diffDays} d ago`;
  }

  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatAbsoluteTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function computeDelta(series: TrendPoint[]): number {
  if (!series.length) {
    return 0;
  }

  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  return last - first;
}

export default async function OperationsPage() {
  const { profile } = await requireUserAndProfile();
  const saccoScope = profile.role === "SYSTEM_ADMIN" ? null : (profile.sacco_id ?? null);
  const snapshot = await getOperationsSnapshot({ saccoId: saccoScope });
  const scopeLabel =
    profile.role === "SYSTEM_ADMIN" ? "All SACCOs" : (profile.sacco?.name ?? "Assigned SACCO");

  const notificationDelta = computeDelta(snapshot.trends.notifications);
  const reconciliationDelta = computeDelta(snapshot.trends.reconciliation);

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="ops.title" fallback="Operations center" />}
        subtitle={
          <Trans
            i18nKey="ops.subtitle"
            fallback="Monitor notification throughput, reconciliation backlog, and critical incidents affecting your SACCO."
            className="text-xs text-ink/70"
          />
        }
        badge={<StatusChip tone="neutral">{scopeLabel}</StatusChip>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard
          title={<Trans i18nKey="ops.notifications.title" fallback="Notification pipeline" />}
          subtitle={
            <Trans
              i18nKey="ops.notifications.subtitle"
              fallback="Ensure outbound SMS and email reminders are flowing without backlog."
              className="text-xs text-neutral-3"
            />
          }
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.notifications.pending" fallback="Pending" />
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-0">
                {numberFormatter.format(snapshot.notifications.pending)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.notifications.next" fallback="Next scheduled" />
              </dt>
              <dd className="mt-1 text-sm text-neutral-0">
                {formatRelativeTime(snapshot.notifications.nextScheduledFor)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.notifications.stalled" fallback="Stalled" />
              </dt>
              <dd className="mt-1 text-sm text-neutral-0">
                {numberFormatter.format(snapshot.notifications.stalled)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.trend.notificationsHeading" fallback="12h throughput" />
              </p>
              <p className="text-sm text-neutral-0">
                {notificationDelta === 0 ? (
                  <Trans i18nKey="ops.trend.flat" fallback="No change" />
                ) : (
                  <>
                    <span className={notificationDelta > 0 ? "text-emerald-300" : "text-amber-300"}>
                      {notificationDelta > 0 ? "+" : "−"}
                      {numberFormatter.format(Math.abs(notificationDelta))}
                    </span>{" "}
                    <Trans i18nKey="ops.trend.vsStart" fallback="vs start" />
                  </>
                )}
              </p>
            </div>
            <Sparkline
              series={snapshot.trends.notifications}
              tone="emerald"
              ariaLabel="Notification events over the last 12 hours"
              className="h-16 w-full sm:w-44"
            />
          </div>
        </GlassCard>

        <GlassCard
          title={<Trans i18nKey="ops.recon.title" fallback="Reconciliation backlog" />}
          subtitle={
            <Trans
              i18nKey="ops.recon.subtitle"
              fallback="Track payment exceptions and escalations requiring manual intervention."
              className="text-xs text-neutral-3"
            />
          }
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.recon.open" fallback="Open" />
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-0">
                {numberFormatter.format(snapshot.reconciliation.open)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.recon.oldest" fallback="Oldest item" />
              </dt>
              <dd className="mt-1 text-sm text-neutral-0">
                {formatRelativeTime(snapshot.reconciliation.oldestOpen)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.recon.escalated" fallback="Escalated" />
              </dt>
              <dd className="mt-1 text-sm text-neutral-0">
                {numberFormatter.format(snapshot.reconciliation.escalated)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-2">
                <Trans i18nKey="ops.trend.reconHeading" fallback="12h backlog intake" />
              </p>
              <p className="text-sm text-neutral-0">
                {reconciliationDelta === 0 ? (
                  <Trans i18nKey="ops.trend.flat" fallback="No change" />
                ) : (
                  <>
                    <span
                      className={reconciliationDelta > 0 ? "text-amber-300" : "text-emerald-300"}
                    >
                      {reconciliationDelta > 0 ? "+" : "−"}
                      {numberFormatter.format(Math.abs(reconciliationDelta))}
                    </span>{" "}
                    <Trans i18nKey="ops.trend.vsStart" fallback="vs start" />
                  </>
                )}
              </p>
            </div>
            <Sparkline
              series={snapshot.trends.reconciliation}
              tone="amber"
              ariaLabel="Reconciliation backlog entries captured over the last 12 hours"
              className="h-16 w-full sm:w-44"
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard
        title={<Trans i18nKey="ops.incidents.title" fallback="Recent incidents" />}
        subtitle={
          <Trans
            i18nKey="ops.incidents.subtitle"
            fallback="Latest audit events that may require operational response."
            className="text-xs text-neutral-3"
          />
        }
      >
        {snapshot.incidents.length === 0 ? (
          <p className="text-sm text-neutral-2">
            <Trans
              i18nKey="ops.incidents.empty"
              fallback="No incidents recorded in the last 24 hours."
            />
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-neutral-0">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.3em] text-neutral-2">
                <tr>
                  <th className="px-4 py-3">
                    <Trans i18nKey="ops.incidents.action" fallback="Action" />
                  </th>
                  <th className="px-4 py-3">
                    <Trans i18nKey="ops.incidents.entity" fallback="Entity" />
                  </th>
                  <th className="px-4 py-3">
                    <Trans i18nKey="ops.incidents.when" fallback="When" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-white/5 text-xs">
                {snapshot.incidents.map((incident) => (
                  <Fragment key={incident.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-neutral-0">{incident.action}</td>
                      <td className="px-4 py-3 text-neutral-2">
                        {incident.entity}:{incident.entityId}
                      </td>
                      <td className="px-4 py-3 text-neutral-2">
                        {formatRelativeTime(incident.occurredAt)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-0">
                        <details className="group border-t border-white/5 bg-white/[0.04]">
                          <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs uppercase tracking-[0.3em] text-neutral-2 transition hover:text-neutral-0">
                            <span>
                              <Trans i18nKey="ops.incidents.details" fallback="Incident details" />
                            </span>
                            <span className="text-[11px] tracking-normal text-neutral-3">
                              {formatAbsoluteTime(incident.occurredAt)}
                            </span>
                          </summary>
                          <div className="space-y-3 px-4 pb-4 text-xs text-neutral-1">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-2">
                                <Trans i18nKey="ops.incidents.diffLabel" fallback="Raw diff" />
                              </p>
                              {incident.diff ? (
                                <pre className="mt-2 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-ink/60 p-4 text-[11px] leading-relaxed text-neutral-1">
                                  {JSON.stringify(incident.diff, null, 2)}
                                </pre>
                              ) : (
                                <p className="mt-2 text-neutral-2">
                                  <Trans
                                    i18nKey="ops.incidents.noDiff"
                                    fallback="No diff captured for this event."
                                  />
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
