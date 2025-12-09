import { GradientHeader } from "@/components/ui/gradient-header";
import { logError } from "@/lib/observability/logger";
import { StatusChip } from "@/components/common/status-chip";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { TapMoMoDashboard } from "@/components/tapmomo/tapmomo-dashboard";

interface TapMoMoPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export const metadata = {
  title: "TapMoMo NFC Payments",
  description: "NFC-based mobile money payments without USSD API",
};

export default async function TapMoMoPage({ searchParams }: TapMoMoPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/tapmomo");

  // Get merchants for the SACCO
  // Cast to any since tapmomo_merchants is in app schema not included in generated types
  let merchantsQuery = (supabase as any)
    .schema("app")
    .from("tapmomo_merchants")
    .select("id, merchant_code, display_name, network, is_active")
    .order("display_name", { ascending: true });

  if (!scope.includeAll && scope.saccoId) {
    merchantsQuery = merchantsQuery.eq("sacco_id", scope.saccoId);
  }

  const { data: merchants, error: merchantsError } = await merchantsQuery;

  if (merchantsError) {
    logError("Error fetching merchants:", merchantsError);
  }

  // Get transaction stats
  // Cast to any since tapmomo_transactions is in app schema not included in generated types
  let statsQuery = (supabase as any)
    .schema("app")
    .from("tapmomo_transactions")
    .select("status", { head: false, count: "exact" });

  if (!scope.includeAll && scope.saccoId) {
    statsQuery = statsQuery.eq("sacco_id", scope.saccoId);
  }

  const [initiatedCount, settledCount, failedCount, expiredCount] = await Promise.all([
    statsQuery.eq("status", "initiated").then((r: any) => r.count || 0),
    statsQuery.eq("status", "settled").then((r: any) => r.count || 0),
    statsQuery.eq("status", "failed").then((r: any) => r.count || 0),
    statsQuery.eq("status", "expired").then((r: any) => r.count || 0),
  ]);

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.tapmomo.title" fallback="TapMoMo NFC Payments" />}
        subtitle={
          <Trans
            i18nKey="admin.tapmomo.subtitle"
            fallback="Tap-to-pay using NFC technology without API integration"
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{scope.includeAll ? "Global" : "Scoped"}</StatusChip>}
      />

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active" value={initiatedCount} tone="info" />
        <StatCard label="Settled" value={settledCount} tone="success" />
        <StatCard label="Failed" value={failedCount} tone="critical" />
        <StatCard label="Expired" value={expiredCount} tone="warning" />
      </div>

      {/* Main Dashboard */}
      <TapMoMoDashboard saccoId={scope.saccoId || undefined} merchants={merchants || []} />

      {/* Info Card */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-6">
        <h3 className="mb-3 text-sm font-semibold text-sky-100">
          <Trans i18nKey="admin.tapmomo.info.title" fallback="About TapMoMo" />
        </h3>
        <div className="space-y-2 text-xs text-sky-200">
          <p>
            <Trans
              i18nKey="admin.tapmomo.info.description"
              fallback="TapMoMo enables contactless mobile money payments using NFC technology. Staff can receive payments by activating their device as a payee, and payers can complete transactions by tapping their phone to the payee's device."
            />
          </p>
          <p>
            <Trans
              i18nKey="admin.tapmomo.info.features"
              fallback="Features: Offline-capable, secure HMAC signing, replay protection, and automatic reconciliation with the payments system."
            />
          </p>
          <p className="pt-2 font-medium text-sky-100">
            <Trans
              i18nKey="admin.tapmomo.info.requirement"
              fallback="⚠️ Requires NFC-enabled Android device"
            />
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
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
