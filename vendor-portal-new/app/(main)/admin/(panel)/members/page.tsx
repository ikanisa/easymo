import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import {
  AdminMembersDirectory,
  MemberDirectoryRow,
} from "@/components/admin/members/directory-table";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { Trans } from "@/components/common/trans";
import { isMissingRelationError } from "@/lib/supabase/errors";

interface MembersPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/members");

  let membersQuery = supabase
    .from("ikimina_members_public")
    .select(
      "id, full_name, member_code, msisdn, status, joined_at, ikimina_id, ikimina_name, sacco_id"
    )
    .order("joined_at", { ascending: false })
    .limit(500);

  if (!scope.includeAll && scope.saccoId) {
    membersQuery = membersQuery.eq("sacco_id", scope.saccoId);
  }

  const { data, error } = await membersQuery;

  if (error && !isMissingRelationError(error)) {
    throw error;
  }

  const members = (data ?? []) as MemberDirectoryRow[];

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.members.title" fallback="Member directory" />}
        subtitle={
          <Trans
            i18nKey="admin.members.subtitle"
            fallback="Search for members across SACCOs, review assignments, and flag frozen accounts."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{members.length} records</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.members.directory" fallback="Directory" />}
        subtitle={
          <Trans
            i18nKey="admin.members.directorySubtitle"
            fallback="Filter by group, status, and search."
            className="text-xs text-neutral-3"
          />
        }
      >
        <AdminMembersDirectory rows={members} />
      </GlassCard>
    </div>
  );
}
