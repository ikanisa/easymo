import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { OutreachAutomationCard } from "@/components/admin/outreach-automation-card";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";

interface PaymentsPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

type PaymentRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  status: string;
  occurred_at: string | null;
  reference: string | null;
  sacco_id: string;
};

type StatusSummary = {
  status: string;
  count: number;
};

const STATUSES = ["UNALLOCATED", "PENDING", "POSTED", "SETTLED", "REJECTED"] as const;

type PaymentStatus = (typeof STATUSES)[number];

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/payments");

  const statusPromises = STATUSES.map(async (status) => {
    let query = supabase
      .schema("app")
      .from("payments")
      .select("id", { head: true, count: "exact" })
      .eq("status", status);
    if (!scope.includeAll && scope.saccoId) {
      query = query.eq("sacco_id", scope.saccoId);
    }
    const { count, error } = await query;
    if (error && !isMissingRelationError(error)) {
      throw error;
    }
    return { status, count: count ?? 0 } satisfies StatusSummary;
  });

  let reconQuery = supabase
    .schema("app")
    .from("recon_exceptions")
    .select("id, payment:payments(sacco_id)");
  if (!scope.includeAll && scope.saccoId) {
    reconQuery = reconQuery.eq("payment.sacco_id", scope.saccoId);
  }
  const reconPromise = reconQuery;

  let latestQuery = supabase
    .schema("app")
    .from("payments")
    .select("id, amount, currency, status, occurred_at, reference, sacco_id")
    .in("status", ["POSTED", "SETTLED"])
    .order("occurred_at", { ascending: false })
    .limit(15);
  if (!scope.includeAll && scope.saccoId) {
    latestQuery = latestQuery.eq("sacco_id", scope.saccoId);
  }

  const [statusSummaries, reconSummary, latestPayments] = await Promise.all([
    Promise.all(statusPromises),
    reconPromise,
    latestQuery,
  ]);

  if (reconSummary.error && !isMissingRelationError(reconSummary.error)) {
    throw reconSummary.error;
  }
  if (latestPayments.error && !isMissingRelationError(latestPayments.error)) {
    throw latestPayments.error;
  }

  const statusMap = new Map<PaymentStatus, number>(
    statusSummaries.map((summary) => [summary.status as PaymentStatus, summary.count])
  );
  const reconCount = (reconSummary.data ?? []).length;
  const payments = (latestPayments.data ?? []) as PaymentRow[];

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.payments.title" fallback="Payments & settlement" />}
        subtitle={
          <Trans
            i18nKey="admin.payments.subtitle"
            fallback="Monitor cash movement, settlement progress, and automation health."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{scope.includeAll ? "Global" : "Scoped"}</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.payments.metrics" fallback="Status overview" />}
        subtitle={
          <Trans
            i18nKey="admin.payments.metricsSubtitle"
            fallback="Counts by reconciliation status and outstanding exceptions."
            className="text-xs text-neutral-3"
          />
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile
            label="Unallocated"
            value={statusMap.get("UNALLOCATED") ?? 0}
            tone="critical"
          />
          <MetricTile label="Pending" value={statusMap.get("PENDING") ?? 0} tone="warning" />
          <MetricTile label="Posted" value={statusMap.get("POSTED") ?? 0} tone="info" />
          <MetricTile label="Settled" value={statusMap.get("SETTLED") ?? 0} tone="success" />
          <MetricTile label="Rejected" value={statusMap.get("REJECTED") ?? 0} tone="critical" />
          <MetricTile label="Open exceptions" value={reconCount} tone="warning" />
        </dl>
      </GlassCard>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <GlassCard
          title={<Trans i18nKey="admin.payments.latest" fallback="Latest settlements" />}
          subtitle={
            <Trans
              i18nKey="admin.payments.latestSubtitle"
              fallback="Recent posted or settled payments grouped by reference."
              className="text-xs text-neutral-3"
            />
          }
        >
          <PaymentsTable rows={payments} />
        </GlassCard>
        <GlassCard
          title={<Trans i18nKey="admin.payments.automation" fallback="Automation" />}
          subtitle={
            <Trans
              i18nKey="admin.payments.automationSubtitle"
              fallback="Re-run reconciliation triggers for aged pending items."
              className="text-xs text-neutral-3"
            />
          }
        >
          <OutreachAutomationCard />
        </GlassCard>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "success" | "warning" | "critical";
}) {
  const toneClasses: Record<typeof tone, string> = {
    info: "from-sky-500/10 via-sky-500/5 to-transparent text-sky-100",
    success: "from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-100",
    warning: "from-amber-500/10 via-amber-500/5 to-transparent text-amber-100",
    critical: "from-rose-500/10 via-rose-500/5 to-transparent text-rose-100",
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/10 to-transparent p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClasses[tone]}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-2">
        <Trans i18nKey="admin.payments.empty" fallback="No recent settlements." />
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-neutral-3">
          <tr>
            <th className="px-4 py-3">
              <Trans i18nKey="admin.payments.table.reference" fallback="Reference" />
            </th>
            <th className="px-4 py-3">
              <Trans i18nKey="admin.payments.table.amount" fallback="Amount" />
            </th>
            <th className="px-4 py-3">
              <Trans i18nKey="admin.payments.table.status" fallback="Status" />
            </th>
            <th className="px-4 py-3">
              <Trans i18nKey="admin.payments.table.occurred" fallback="Occurred" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/5">
              <td className="px-4 py-3 text-neutral-0">{row.reference ?? row.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-neutral-2">
                {typeof row.amount === "number"
                  ? `${row.amount.toLocaleString()} ${row.currency ?? "RWF"}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-neutral-2">{row.status}</td>
              <td className="px-4 py-3 text-neutral-2">
                {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
