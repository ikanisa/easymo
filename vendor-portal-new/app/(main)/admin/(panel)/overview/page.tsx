import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { NotificationQueueTable } from "@/components/admin/notification-queue-table";
import { OperationalTelemetry } from "@/components/admin/operational-telemetry";
import { AuditLogTable, type AuditLogEntry } from "@/components/admin/audit-log-table";
import { FeatureFlagsCard } from "@/components/admin/feature-flags-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { Trans } from "@/components/common/trans";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { logError } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/types";

interface OverviewPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

interface MetricSummary {
  saccos: number;
  groups: number;
  members: number;
  pendingApprovals: number;
  pendingInvites: number;
  reconciliationExceptions: number;
}

type NotificationRow = {
  id: string;
  event: string;
  sacco_id: string | null;
  template_id: string | null;
  status: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  channel: string | null;
};

type TelemetryRow = {
  event: string;
  total: number | null;
  last_occurred: string | null;
  meta: Record<string, unknown> | null;
};

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string | null;
  actor: string | null;
};

async function loadMetrics(scope: ReturnType<typeof resolveTenantScope>): Promise<MetricSummary> {
  const supabase = createSupabaseServiceRoleClient("admin/panel/overview:metrics");
  const pendingInvitesPromise = computePendingInviteCount(supabase, scope);

  const saccoQuery = scope.includeAll
    ? supabase.from("saccos").select("id", { head: true, count: "exact" })
    : supabase
        .schema("app")
        .from("saccos")
        .select("id", { head: true, count: "exact" })
        .eq("id", scope.saccoId ?? "");

  const groupsQuery = scope.includeAll
    ? supabase.from("ibimina").select("id", { head: true, count: "exact" })
    : supabase
        .schema("app")
        .from("ikimina")
        .select("id", { head: true, count: "exact" })
        .eq("sacco_id", scope.saccoId ?? "");

  const membersQuery = scope.includeAll
    ? supabase.from("ikimina_members").select("id", { head: true, count: "exact" })
    : supabase
        .schema("app")
        .from("members")
        .select("id", { head: true, count: "exact" })
        .eq("sacco_id", scope.saccoId ?? "");

  const approvalsQuery = scope.includeAll
    ? supabase
        .from("join_requests")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending")
    : supabase
        .from("join_requests")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending")
        .eq("sacco_id", scope.saccoId ?? "");

  const exceptionQuery = scope.includeAll
    ? supabase
        .schema("app")
        .from("payments")
        .select("id", { head: true, count: "exact" })
        .in("status", ["UNALLOCATED", "PENDING", "REJECTED"])
    : supabase
        .schema("app")
        .from("payments")
        .select("id", { head: true, count: "exact" })
        .in("status", ["UNALLOCATED", "PENDING", "REJECTED"])
        .eq("sacco_id", scope.saccoId ?? "");

  const [saccos, groups, members, approvals, exceptions] = await Promise.all([
    saccoQuery,
    groupsQuery,
    membersQuery,
    approvalsQuery,
    exceptionQuery,
  ]);
  const inviteCount = await pendingInvitesPromise;

  const safeCount = (result: { count: number | null; error: unknown }) => {
    const { count, error } = result;
    if (!error) return count ?? 0;
    if (isMissingRelationError(error)) return 0;
    throw error;
  };

  return {
    saccos: safeCount(saccos),
    groups: safeCount(groups),
    members: safeCount(members),
    pendingApprovals: safeCount(approvals),
    pendingInvites: inviteCount,
    reconciliationExceptions: safeCount(exceptions),
  };
}

async function computePendingInviteCount(
  supabase: SupabaseClient<Database>,
  scope: ReturnType<typeof resolveTenantScope>
): Promise<number> {
  try {
    if (scope.includeAll) {
      const { count, error } = await supabase
        .from("group_invites")
        .select("id", { head: true, count: "exact" })
        .eq("status", "sent");
      if (error) {
        throw error;
      }
      return Number(count ?? 0);
    }

    if (!scope.saccoId) {
      return 0;
    }

    const { data: inviteRows, error: inviteError } = await supabase
      .from("group_invites")
      .select("id, group_id")
      .eq("status", "sent");
    if (inviteError) {
      throw inviteError;
    }

    const invites = (inviteRows ?? []) as Array<{ group_id: string | null }>;
    const groupIds = Array.from(
      new Set(
        invites
          .map((row) => row.group_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    if (groupIds.length === 0) {
      return 0;
    }

    const { data: groupRows, error: groupError } = await supabase
      .schema("app")
      .from("ikimina")
      .select("id, sacco_id")
      .in("id", groupIds);

    if (groupError) {
      throw groupError;
    }

    const saccoLookup = new Map<string, string | null>(
      (groupRows ?? []).map((row) => [String(row.id), (row.sacco_id as string | null) ?? null])
    );

    return invites.filter((row) => {
      const groupId = row.group_id;
      if (!groupId) return false;
      return saccoLookup.get(groupId) === scope.saccoId;
    }).length;
  } catch (error) {
    if (!isMissingRelationError(error)) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logError("admin.overview.pending_invites_failed", { error: errMsg });
    }
    return 0;
  }
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);

  const header = (
    <GradientHeader
      title={<Trans i18nKey="admin.overview.title" fallback="Admin overview" />}
      subtitle={
        <Trans
          i18nKey="admin.overview.subtitle"
          fallback="Monitor core operations across SACCOs, groups, members, and financial reconciliation."
          className="text-xs text-neutral-3"
        />
      }
      badge={
        <StatusChip tone="info">
          {scope.includeAll ? "Global" : (profile.sacco?.name ?? "Scoped")}
        </StatusChip>
      }
    />
  );

  const supabase = createSupabaseServiceRoleClient("admin/panel/overview");
  let metrics: MetricSummary | null = null;
  let telemetryMetrics: Array<{
    event: string;
    total: number;
    last_occurred: string | null;
    meta: Record<string, unknown> | null;
  }> = [];
  let notificationRows: NotificationRow[] = [];
  let auditEntries: AuditLogEntry[] = [];
  let overviewError: unknown = null;

  try {
    const metricsPromise = loadMetrics(scope);

    let notificationQuery = supabase
      .from("notification_queue")
      .select("id, event, sacco_id, template_id, status, scheduled_for, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!scope.includeAll && scope.saccoId) {
      notificationQuery = notificationQuery.eq("sacco_id", scope.saccoId);
    }

    const telemetryQuery = supabase
      .from("system_metrics")
      .select("event, total, last_occurred, meta")
      .order("last_occurred", { ascending: false })
      .limit(20);

    let auditQuery = supabase
      .schema("app")
      .from("audit_logs")
      .select("id, action, entity, entity_id, diff, created_at, actor, sacco_id")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!scope.includeAll && scope.saccoId) {
      auditQuery = auditQuery.eq("sacco_id", scope.saccoId);
    }

    const [notificationResponse, telemetryResponse, auditResponse] =
      await Promise.all([notificationQuery, telemetryQuery, auditQuery]);

    if (notificationResponse.error && !isMissingRelationError(notificationResponse.error)) {
      const err = notificationResponse.error as PostgrestError;
      logError("admin.overview.notification_query_failed", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
    }
    if (telemetryResponse.error && !isMissingRelationError(telemetryResponse.error)) {
      const err = telemetryResponse.error as PostgrestError;
      logError("admin.overview.telemetry_query_failed", { message: err.message, code: err.code });
    }
    if (auditResponse.error && !isMissingRelationError(auditResponse.error)) {
      const err = auditResponse.error as PostgrestError;
      logError("admin.overview.audit_query_failed", { message: err.message, code: err.code });
    }

    metrics = await metricsPromise;

    telemetryMetrics = ((telemetryResponse.data ?? []) as TelemetryRow[]).map((row) => ({
      event: row.event,
      total: Number(row.total ?? 0),
      last_occurred: row.last_occurred,
      meta: row.meta,
    }));

    notificationRows = (notificationResponse.data ?? []) as NotificationRow[];

    const auditRows = (auditResponse.data ?? []) as AuditRow[];
    const actorIds = Array.from(
      new Set(
        auditRows
          .map((row) => row.actor)
          .filter((value): value is string => Boolean(value && value.length > 0))
      )
    );

    let actorLookup = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actorData, error: actorError } = await supabase
        .from("users")
        .select("id, email")
        .in("id", actorIds);
      if (actorError && !isMissingRelationError(actorError)) {
        const err = actorError as PostgrestError;
        logError("admin.overview.actor_lookup_failed", { message: err.message, code: err.code });
      }
      actorLookup = new Map((actorData ?? []).map((row) => [String(row.id), row.email ?? ""]));
    }

    auditEntries = auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      diff: row.diff,
      actorLabel: row.actor ? (actorLookup.get(row.actor) ?? row.actor) : "—",
      createdAt: row.created_at ?? new Date().toISOString(),
    }));
  } catch (error) {
    if (!isMissingRelationError(error)) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logError("admin.overview.render_failed", { error: errMsg });
    }
    overviewError = error;
  }

  if (!metrics || overviewError) {
    return (
      <div className="space-y-8">
        {header}
        <GlassCard
          title={<Trans i18nKey="admin.overview.metrics.title" fallback="Key metrics" />}
          subtitle={
            <Trans
              i18nKey="admin.overview.metrics.subtitle"
              fallback="Latest counts for your current tenant scope."
              className="text-xs text-neutral-3"
            />
          }
        >
          <EmptyState
            title="We couldn't load the admin overview"
            description="Check your Supabase configuration and try again."
          />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <GlassCard
        title={<Trans i18nKey="admin.overview.metrics.title" fallback="Key metrics" />}
        subtitle={
          <Trans
            i18nKey="admin.overview.metrics.subtitle"
            fallback="Latest counts for your current tenant scope."
            className="text-xs text-neutral-3"
          />
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile label="SACCOs" value={metrics.saccos} tone="info" />
          <MetricTile label="Groups" value={metrics.groups} tone="info" />
          <MetricTile label="Members" value={metrics.members} tone="success" />
          <MetricTile label="Pending approvals" value={metrics.pendingApprovals} tone="warning" />
          <MetricTile label="Pending invites" value={metrics.pendingInvites} tone="warning" />
          <MetricTile
            label="Reconciliation exceptions"
            value={metrics.reconciliationExceptions}
            tone="critical"
          />
        </dl>
      </GlassCard>

      <div className="grid gap-8 xl:grid-cols-2">
        <GlassCard
          title={
            <Trans i18nKey="admin.overview.telemetry.title" fallback="Operational telemetry" />
          }
          subtitle={
            <Trans
              i18nKey="admin.overview.telemetry.subtitle"
              fallback="Recent platform events and signals."
              className="text-xs text-neutral-3"
            />
          }
        >
          <OperationalTelemetry metrics={telemetryMetrics} />
        </GlassCard>

        <GlassCard
          title={
            <Trans i18nKey="admin.overview.notifications.title" fallback="Notification queue" />
          }
          subtitle={
            <Trans
              i18nKey="admin.overview.notifications.subtitle"
              fallback="Scheduled and recent deliveries."
              className="text-xs text-neutral-3"
            />
          }
        >
          <NotificationQueueTable
            rows={notificationRows}
            saccoLookup={new Map()}
            templateLookup={new Map()}
          />
        </GlassCard>
      </div>

      <div className="grid gap-8 xl:grid-cols-[2fr,1fr]">
        <GlassCard
          title={<Trans i18nKey="admin.overview.audit.title" fallback="Audit timeline" />}
          subtitle={
            <Trans
              i18nKey="admin.overview.audit.subtitle"
              fallback="Latest platform actions"
              className="text-xs text-neutral-3"
            />
          }
        >
          <AuditLogTable rows={auditEntries} />
        </GlassCard>
        <div className="space-y-8">
          <FeatureFlagsCard />
        </div>
      </div>
    </div>
  );
}

interface MetricTileProps {
  label: string;
  value: number;
  tone: "info" | "success" | "warning" | "critical";
}

function MetricTile({ label, value, tone }: MetricTileProps) {
  const toneClasses: Record<MetricTileProps["tone"], string> = {
    info: "from-sky-500/20 via-sky-500/10 to-transparent text-sky-100",
    success: "from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-100",
    warning: "from-amber-500/20 via-amber-500/10 to-transparent text-amber-100",
    critical: "from-rose-500/20 via-rose-500/10 to-transparent text-rose-100",
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/10 to-transparent p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">{label}</p>
      <p className={`mt-3 text-4xl font-semibold ${toneClasses[tone]}`}>{value.toLocaleString()}</p>
    </div>
  );
}
