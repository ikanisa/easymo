import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import {
  TenantSettingsPanel,
  type TenantSettingsRecord,
} from "@/components/admin/settings/tenant-settings-panel";
import { SecurityOperationsCard } from "@/components/admin/settings/security-operations-card";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";

// Settings change infrequently, enable caching with revalidation
export const revalidate = 300; // 5 minutes

interface SettingsPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

type SaccoRow = {
  id: string;
  name: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/settings");

  let saccoQuery = supabase
    .schema("app")
    .from("saccos")
    .select("id, name, metadata")
    .order("name", { ascending: true });

  if (profile.role !== "SYSTEM_ADMIN") {
    if (profile.sacco_id) {
      saccoQuery = saccoQuery.eq("id", profile.sacco_id);
    } else {
      saccoQuery = saccoQuery.limit(1);
    }
  }

  const { data, error } = await saccoQuery;
  if (error && !isMissingRelationError(error)) {
    throw error;
  }

  const saccoRecords: TenantSettingsRecord[] = (data ?? []).map((row) => ({
    saccoId: String(row.id),
    saccoName: row.name ?? "Unnamed SACCO",
    metadata: (row.metadata as SaccoRow["metadata"]) ?? null,
  }));

  const badgeLabel = scope.includeAll
    ? "Global"
    : (saccoRecords.find((item) => item.saccoId === scope.saccoId)?.saccoName ??
      profile.sacco?.name ??
      "Scoped");

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.settings.title" fallback="Settings & policies" />}
        subtitle={
          <Trans
            i18nKey="admin.settings.subtitle"
            fallback="Define governance, thresholds, and integrations per tenant."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{badgeLabel}</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.settings.tenant" fallback="Tenant controls" />}
        subtitle={
          <Trans
            i18nKey="admin.settings.tenantSubtitle"
            fallback="Document board-approved rules, escalation thresholds, and connected systems."
            className="text-xs text-neutral-3"
          />
        }
      >
        {saccoRecords.length > 0 ? (
          <TenantSettingsPanel
            saccos={saccoRecords}
            canEdit={profile.role === "SYSTEM_ADMIN"}
            initialSaccoId={scope.saccoId ?? saccoRecords[0]?.saccoId ?? null}
          />
        ) : (
          <p className="text-sm text-neutral-2">
            <Trans
              i18nKey="admin.settings.noRecords"
              fallback="Assign a SACCO to your profile or ask a system admin for access."
            />
          </p>
        )}
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.settings.security" fallback="Security operations" />}
        subtitle={
          <Trans
            i18nKey="admin.settings.securitySubtitle"
            fallback="Perform emergency maintenance for staff access."
            className="text-xs text-neutral-3"
          />
        }
      >
        <SecurityOperationsCard />
      </GlassCard>
    </div>
  );
}
