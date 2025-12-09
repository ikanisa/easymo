import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { IkiminaTable } from "@/components/ikimina/ikimina-table";
import { requireUserAndProfile } from "@/lib/auth";
import { getIkiminaDirectorySummary } from "@/lib/ikimina/list";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { Trans } from "@/components/common/trans";

interface GroupsPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const { rows, statusOptions, typeOptions, saccoOptions } = await getIkiminaDirectorySummary({
    saccoId: scope.saccoId,
    includeAll: scope.includeAll,
  });

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.groups.title" fallback="Groups" />}
        subtitle={
          <Trans
            i18nKey="admin.groups.subtitle"
            fallback="Review group health, activity, and configuration settings."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{rows.length} groups</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.groups.directory" fallback="Directory" />}
        subtitle={
          <Trans
            i18nKey="admin.groups.directorySubtitle"
            fallback="Filter by status, type, and tenant."
            className="text-xs text-neutral-3"
          />
        }
      >
        <IkiminaTable
          rows={rows}
          statusOptions={statusOptions}
          typeOptions={typeOptions}
          saccoOptions={saccoOptions}
          showSaccoColumn={scope.includeAll}
        />
      </GlassCard>
    </div>
  );
}
