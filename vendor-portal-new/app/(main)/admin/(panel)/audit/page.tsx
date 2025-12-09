import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { AuditLogTable, type AuditLogEntry } from "@/components/admin/audit-log-table";
import { AuditFilters, type AuditFiltersState } from "@/components/admin/audit/audit-filters";
import { AuditExportButton } from "@/components/admin/audit/audit-export-button";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";

// Audit logs are historical, can be cached with short revalidation
export const revalidate = 60; // 1 minute

interface AuditPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string | null;
  actor: string | null;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/audit");

  const filters: AuditFiltersState = {
    action: getParam(resolvedSearchParams?.["action"]),
    entity: getParam(resolvedSearchParams?.["entity"]),
    actor: getParam(resolvedSearchParams?.["actor"]),
    from: getParam(resolvedSearchParams?.["from"]),
    to: getParam(resolvedSearchParams?.["to"]),
  };

  const actorFilterIds: string[] = [];
  if (filters.actor) {
    const { data: matchedActors, error: actorError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", `%${filters.actor}%`)
      .limit(100);
    if (actorError && !isMissingRelationError(actorError)) {
      throw actorError;
    }
    actorFilterIds.push(...(matchedActors ?? []).map((row) => String(row.id)));
  }

  let query = supabase
    .schema("app")
    .from("audit_logs")
    .select("id, action, entity, entity_id, diff, created_at, actor, sacco_id")
    .order("created_at", { ascending: false })
    .limit(150);

  if (!scope.includeAll && scope.saccoId) {
    query = query.eq("sacco_id", scope.saccoId);
  }
  if (filters.action) {
    query = query.ilike("action", `%${filters.action}%`);
  }
  if (filters.entity) {
    query = query.ilike("entity", `%${filters.entity}%`);
  }
  if (filters.actor) {
    if (actorFilterIds.length > 0) {
      query = query.in("actor", actorFilterIds);
    } else {
      query = query.eq("actor", filters.actor);
    }
  }
  if (filters.from) {
    query = query.gte("created_at", new Date(`${filters.from}T00:00:00Z`).toISOString());
  }
  if (filters.to) {
    query = query.lte("created_at", new Date(`${filters.to}T23:59:59.999Z`).toISOString());
  }

  const { data, error } = await query;
  if (error && !isMissingRelationError(error)) {
    throw error;
  }

  const auditRows = (data ?? []) as AuditRow[];
  const actorIds = Array.from(
    new Set(
      auditRows
        .map((row) => row.actor)
        .filter((value): value is string => Boolean(value && value.length > 0))
    )
  );

  let actorLookup = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actorRows, error: actorLoadError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", actorIds);
    if (actorLoadError && !isMissingRelationError(actorLoadError)) {
      throw actorLoadError;
    }
    actorLookup = new Map((actorRows ?? []).map((row) => [String(row.id), row.email ?? ""]));
  }

  const entries: AuditLogEntry[] = auditRows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    diff: row.diff,
    createdAt: row.created_at ?? new Date().toISOString(),
    actorLabel: deriveActorLabel(row.actor, actorLookup),
  }));

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.audit.title" fallback="Audit & logs" />}
        subtitle={
          <Trans
            i18nKey="admin.audit.subtitle"
            fallback="Trace privileged actions, configuration changes, and access reviews."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{entries.length} records</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.audit.filters.title" fallback="Filters" />}
        subtitle={
          <Trans
            i18nKey="admin.audit.filters.subtitle"
            fallback="Narrow the timeline by action type, actor, or date range."
            className="text-xs text-neutral-3"
          />
        }
      >
        <AuditFilters initial={filters} />
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.audit.timeline" fallback="Timeline" />}
        subtitle={
          <Trans
            i18nKey="admin.audit.timelineSubtitle"
            fallback="Latest 150 events sorted by recency."
            className="text-xs text-neutral-3"
          />
        }
        actions={
          <AuditExportButton
            filters={filters}
            saccoId={scope.saccoId ?? null}
            includeAll={scope.includeAll}
          />
        }
      >
        <AuditLogTable rows={entries} />
      </GlassCard>
    </div>
  );
}

function getParam(input: string | string[] | undefined): string {
  if (!input) return "";
  return Array.isArray(input) ? (input[0] ?? "") : input;
}

function deriveActorLabel(actor: string | null, lookup: Map<string, string>): string {
  if (!actor) return "—";
  const email = lookup.get(actor);
  if (email && email.length > 0) {
    return email;
  }
  return actor;
}
