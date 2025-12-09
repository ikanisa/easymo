import { GradientHeader } from "@/components/ui/gradient-header";
import { logWarn, logError } from "@/lib/observability/logger";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { StatementImportWizard } from "@/components/ikimina/statement-import-wizard";
import {
  ReconciliationTable,
  type ReconciliationRow,
} from "@/components/recon/reconciliation-table";
import { SmsInboxPanel } from "@/components/recon/sms-inbox-panel";
import { AutomationHealthBanner } from "@/components/recon/automation-health-banner";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { canImportStatements, canReconcilePayments, isSystemAdmin } from "@/lib/permissions";
import type { Database } from "@/lib/supabase/types";
import { getAutomationHealthStub } from "@/lib/e2e/automation-health-store";

const EXCEPTION_STATUSES = ["UNALLOCATED", "PENDING", "REJECTED"] as const;

const parseSmsJson = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      logWarn("Unable to parse SMS JSON string", error);
    }
  }
  return null;
};

interface ReconciliationPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export default async function AdminReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/reconciliation");

  type PaymentRow = Database["app"]["Tables"]["payments"]["Row"] & {
    source: {
      raw_text: string | null;
      parsed_json: Database["app"]["Tables"]["sms_inbox"]["Row"]["parsed_json"];
      msisdn: string | null;
      received_at: string | null;
    } | null;
  };

  let paymentsQuery = supabase
    .schema("app")
    .from("payments")
    .select(
      "id, sacco_id, ikimina_id, member_id, msisdn, reference, amount, occurred_at, status, source:sms_inbox(raw_text, parsed_json, msisdn, received_at)"
    )
    .in("status", EXCEPTION_STATUSES)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (!scope.includeAll && scope.saccoId) {
    paymentsQuery = paymentsQuery.eq("sacco_id", scope.saccoId);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery.returns<PaymentRow[]>();

  if (paymentsError) {
    throw paymentsError;
  }

  const exceptionRows: ReconciliationRow[] = ((payments ?? []) as PaymentRow[]).map((row) => ({
    ...row,
    source: row.source
      ? {
          raw_text: row.source.raw_text ?? "",
          parsed_json: row.source.parsed_json,
          msisdn: row.source.msisdn,
          received_at: row.source.received_at ?? "",
        }
      : null,
  }));

  let smsQuery = supabase
    .schema("app")
    .from("sms_inbox")
    .select("id, raw_text, parsed_json, msisdn, received_at, status, confidence, error, sacco_id")
    .order("received_at", { ascending: false })
    .limit(60);

  if (!scope.includeAll && scope.saccoId) {
    smsQuery = smsQuery.eq("sacco_id", scope.saccoId);
  }

  const { data: smsEntries, error: smsError } = await smsQuery;

  if (smsError) {
    throw smsError;
  }

  const automationStub = getAutomationHealthStub();

  type PollerRow = {
    id: string;
    display_name: string | null;
    status: string | null;
    last_polled_at: string | null;
    last_error: string | null;
    last_latency_ms: number | null;
  };
  type SmsGatewayEndpointRow = {
    id: string;
    display_name: string | null;
    status: string | null;
    last_status: string | null;
    last_heartbeat_at: string | null;
    last_error: string | null;
    last_latency_ms: number | null;
  };

  let pollerIssues: Parameters<typeof AutomationHealthBanner>[0]["pollers"] = [];
  let gatewayIssues: Parameters<typeof AutomationHealthBanner>[0]["gateways"] = [];

  if (automationStub) {
    pollerIssues = automationStub.pollers.map((item) => ({
      id: item.id,
      name: item.displayName,
      status: item.status,
      lastPolledAt: item.lastPolledAt ?? null,
      lastError: item.lastError ?? null,
      latencyMs: item.lastLatencyMs ?? null,
    }));
    gatewayIssues = automationStub.gateways.map((item) => ({
      id: item.id,
      name: item.displayName,
      status: item.status,
      lastHeartbeatAt: item.lastHeartbeatAt ?? null,
      lastError: item.lastError ?? null,
      latencyMs: item.lastLatencyMs ?? null,
    }));
  } else {
    const now = Date.now();
    const pollerStaleThreshold = now - 15 * 60 * 1000;
    const gatewayStaleThreshold = now - 10 * 60 * 1000;

    try {
      const [pollerRows, gatewayRows] = await Promise.all([
        supabase
          .schema("app")
          .from("momo_statement_pollers" as any)
          .select("id, display_name, status, last_polled_at, last_error, last_latency_ms")
          .order("display_name", { ascending: true })
          .returns<PollerRow[]>(),
        supabase
          .schema("app")
          .from("sms_gateway_endpoints" as any)
          .select(
            "id, display_name, status, last_status, last_heartbeat_at, last_error, last_latency_ms"
          )
          .order("display_name", { ascending: true })
          .returns<SmsGatewayEndpointRow[]>(),
      ]);

      pollerIssues = (pollerRows?.data ?? [])
        .filter((row) => {
          const lastPolled = row.last_polled_at ? Date.parse(row.last_polled_at) : null;
          const stale = lastPolled ? lastPolled < pollerStaleThreshold : true;
          const hasError = Boolean(row.last_error);
          const inactive = row.status !== "ACTIVE";
          return stale || hasError || inactive;
        })
        .map((row) => ({
          id: row.id,
          name: row.display_name ?? "MoMo poller",
          status: row.status ?? "UNKNOWN",
          lastPolledAt: row.last_polled_at ?? null,
          lastError: row.last_error ?? null,
          latencyMs: row.last_latency_ms ?? null,
        }));

      gatewayIssues = (gatewayRows?.data ?? [])
        .filter((row) => {
          const lastHeartbeat = row.last_heartbeat_at ? Date.parse(row.last_heartbeat_at) : null;
          const stale = lastHeartbeat ? lastHeartbeat < gatewayStaleThreshold : true;
          const unhealthy = row.last_status !== "UP" || Boolean(row.last_error);
          const disabled = row.status !== "ACTIVE";
          return stale || unhealthy || disabled;
        })
        .map((row) => ({
          id: row.id,
          name: row.display_name ?? row.id,
          status: row.last_status ?? row.status ?? "UNKNOWN",
          lastHeartbeatAt: row.last_heartbeat_at ?? null,
          lastError: row.last_error ?? null,
          latencyMs: row.last_latency_ms ?? null,
        }));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logError(`[admin/reconciliation] Failed to fetch automation health: ${errMsg}`);
      // Leave pollerIssues and gatewayIssues as empty arrays
    }
  }

  const smsPanelItems = (smsEntries ?? []).map((item) => ({
    id: item.id,
    raw_text: item.raw_text,
    parsed_json: parseSmsJson(item.parsed_json),
    msisdn: item.msisdn,
    received_at: item.received_at,
    status: item.status ?? "UNPARSED",
    confidence: item.confidence,
    error: item.error ?? null,
  }));

  const saccoIdForWrites = scope.includeAll ? profile.sacco_id : scope.saccoId;
  const allowStatementImport = saccoIdForWrites
    ? canImportStatements(profile, saccoIdForWrites)
    : isSystemAdmin(profile);
  const allowReconciliationUpdates = saccoIdForWrites
    ? canReconcilePayments(profile, saccoIdForWrites)
    : isSystemAdmin(profile);

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.reconciliation.title" fallback="Deposits & Reconciliation" />}
        subtitle={
          <Trans
            i18nKey="admin.reconciliation.subtitle"
            fallback="Manage statement ingestion, SMS parsing, and reconciliation exceptions."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="warning">{exceptionRows.length} pending</StatusChip>}
      />

      <AutomationHealthBanner pollers={pollerIssues} gateways={gatewayIssues} />

      <GlassCard
        title={<Trans i18nKey="admin.reconciliation.momo" fallback="MoMo statement ingest" />}
        subtitle={
          <Trans
            i18nKey="admin.reconciliation.momoSubtitle"
            fallback="Validate and upload statements with strict idempotency."
            className="text-xs text-neutral-3"
          />
        }
        actions={
          saccoIdForWrites ? (
            <StatementImportWizard
              saccoId={saccoIdForWrites}
              variant="momo"
              canImport={allowStatementImport}
              disabledReason="Read-only access"
            />
          ) : undefined
        }
      >
        {saccoIdForWrites ? (
          <div className="space-y-2 text-sm text-neutral-2">
            <p className="text-xs text-neutral-3">
              <Trans
                i18nKey="admin.reconciliation.momoNote1"
                fallback="Drag-and-drop MTN CSV exports. Parser feedback surfaces duplicates and validation errors before ingest."
              />
            </p>
            <p className="text-xs text-neutral-3">
              <Trans
                i18nKey="admin.reconciliation.momoNote2"
                fallback="Only validated rows reach Supabase; invalid entries remain quarantined for follow-up."
              />
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-3">
            <Trans
              i18nKey="admin.reconciliation.assignTenant"
              fallback="Select a SACCO to enable statement ingestion."
            />
          </p>
        )}
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.reconciliation.sms" fallback="SMS inbox" />}
        subtitle={
          <Trans
            i18nKey="admin.reconciliation.smsSubtitle"
            fallback="Latest gateway messages awaiting parser review."
            className="text-xs text-neutral-3"
          />
        }
      >
        <SmsInboxPanel items={smsPanelItems} />
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.reconciliation.exceptions" fallback="Exceptions" />}
        subtitle={
          <Trans
            i18nKey="admin.reconciliation.exceptionsSubtitle"
            fallback="Resolve unmatched deposits and reconcile ledgers."
            className="text-xs text-neutral-3"
          />
        }
      >
        <ReconciliationTable
          rows={exceptionRows}
          saccoId={saccoIdForWrites}
          canWrite={allowReconciliationUpdates}
        />
      </GlassCard>
    </div>
  );
}
