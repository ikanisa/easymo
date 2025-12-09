import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import {
  AdminApprovalsPanel,
  JoinRequestItem,
  InviteItem,
} from "@/components/admin/approvals/approvals-panel";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { Trans } from "@/components/common/trans";
import type { Database } from "@/lib/supabase/types";

interface ApprovalsPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/approvals");

  let joinQuery = supabase
    .from("join_requests")
    .select("id, created_at, status, note, sacco_id, user_id, group_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!scope.includeAll && scope.saccoId) {
    joinQuery = joinQuery.eq("sacco_id", scope.saccoId);
  }

  let inviteQuery = supabase
    .from("group_invites")
    .select("id, created_at, status, invitee_msisdn, group_id, group:ibimina(name, sacco_id)")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!scope.includeAll && scope.saccoId) {
    inviteQuery = inviteQuery.filter("group.sacco_id", "eq", scope.saccoId);
  }

  const [{ data: joinRows, error: joinError }, { data: inviteRows, error: inviteError }] =
    await Promise.all([joinQuery, inviteQuery]);

  if (joinError && !isMissingRelationError(joinError)) {
    throw joinError;
  }
  if (inviteError && !isMissingRelationError(inviteError)) {
    throw inviteError;
  }

  type JoinRequestRow = Pick<
    Database["public"]["Tables"]["join_requests"]["Row"],
    "id" | "created_at" | "status" | "note" | "sacco_id" | "user_id" | "group_id"
  >;

  const joinRowsData = (joinRows ?? []) as JoinRequestRow[];

  const groupIds = Array.from(new Set(joinRowsData.map((row) => row.group_id)));
  const userIds = Array.from(
    new Set(joinRowsData.map((row) => row.user_id).filter(Boolean))
  ) as string[];

  const [groupLookup, userLookup] = await Promise.all([
    groupIds.length > 0
      ? supabase.schema("app").from("ikimina").select("id, name, sacco_id").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from("users").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (groupLookup.error) {
    throw groupLookup.error;
  }
  if (userLookup.error) {
    throw userLookup.error;
  }

  const groupMap = new Map(
    (
      (groupLookup.data ?? []) as Array<{
        id: string;
        name: string | null;
        sacco_id: string | null;
      }>
    ).map((row) => [row.id, row])
  );
  const userMap = new Map(
    ((userLookup.data ?? []) as Array<{ id: string; email: string | null }>).map((row) => [
      row.id,
      row.email ?? null,
    ])
  );

  const joinRequests: JoinRequestItem[] = joinRowsData.map((row) => {
    const group = groupMap.get(row.group_id);
    return {
      id: row.id,
      created_at: row.created_at,
      status: row.status,
      note: row.note,
      user_id: row.user_id ?? null,
      user_email: row.user_id ? (userMap.get(row.user_id) ?? null) : null,
      group_name: group?.name ?? null,
      sacco_id: row.sacco_id ?? group?.sacco_id ?? null,
    } satisfies JoinRequestItem;
  });

  const invites: InviteItem[] = (inviteRows ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    status: row.status,
    invitee_msisdn: row.invitee_msisdn ?? null,
    group_name: row.group?.name ?? null,
    sacco_id: row.group?.sacco_id ?? null,
  }));

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.approvals.title" fallback="Approvals & Invites" />}
        subtitle={
          <Trans
            i18nKey="admin.approvals.subtitle"
            fallback="Approve member join requests, manage invites, and capture reasoning for audit."
            className="text-xs text-neutral-3"
          />
        }
        badge={
          <StatusChip tone="warning">{joinRequests.length + invites.length} pending</StatusChip>
        }
      />

      <GlassCard
        title={<Trans i18nKey="admin.approvals.queue" fallback="Queues" />}
        subtitle={
          <Trans
            i18nKey="admin.approvals.queueSubtitle"
            fallback="Handle member onboarding flows across tenants."
            className="text-xs text-neutral-3"
          />
        }
      >
        <AdminApprovalsPanel joinRequests={joinRequests} invites={invites} />
      </GlassCard>
    </div>
  );
}
